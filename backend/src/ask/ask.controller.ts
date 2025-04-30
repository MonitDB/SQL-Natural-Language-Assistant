import { BadRequestException, Body, Controller, Get, HttpException, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { AskService } from './ask.service';
import { AskRequestDto } from './dto/ask-request.dto';
import { AskResponseDto } from './dto/ask-response.dto';
import { DatabaseService } from '../database/database.service';
import { BadRequestError } from 'openai';

@ApiTags('Ask API')
@Controller('ask')
export class AskController {
  private readonly logger = new Logger(AskController.name);

  constructor(
    private readonly askService: AskService,
    private readonly databaseService: DatabaseService
  ) {}

  @ApiOperation({ summary: 'API health check' })
  @ApiResponse({ 
    status: 200, 
    description: 'API is running and available' 
  })
  @Get()
  getHello(): string {
    return 'Ask API is running!';
  }

  @ApiOperation({ 
    summary: 'Process natural language query against Oracle DB', 
    description: 'Translates natural language to SQL, executes it on the specified Oracle database, and returns both raw results and human-readable summary'
  })
  @ApiBody({ type: AskRequestDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Query processed successfully',
    type: AskResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid request data'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Database connection error or query execution error'
  })
  @ApiResponse({
    status: 207,
    description: 'Partial success with limited results due to rate limiting or token size constraints',
    type: AskResponseDto
  })
  @Post()
  async ask(@Body() askRequestDto: AskRequestDto): Promise<AskResponseDto> {
    this.logger.log(`Processing natural language query: ${askRequestDto.prompt}`);
    
    try {
      return await this.askService.processQuery(askRequestDto);
    } catch (error) {
      this.logger.error(`Error processing ask request: ${error.message}`);
      
      // Return a proper response with error info instead of throwing an exception
      const isRateLimit = error.message.includes('429') || 
                         error.message.includes('rate limit') || 
                         error.message.includes('tokens');
      
      return {
        result: isRateLimit ? 
          "The database information was successfully retrieved, but the query was too large for AI processing. " +
          "Try a more specific query focusing on fewer tables or a single schema." : 
          "The query could not be completed due to an error.",
        executedQueries: [],
        rawResults: [],
        suggestedPrompts: [
          "Try a more specific query with fewer tables",
          "Focus on a single schema",
          "Query specific tables instead of the entire database"
        ],
        errorInfo: {
          error: true,
          message: error.message,
          type: isRateLimit ? 'RATE_LIMIT_EXCEEDED' : 'GENERAL_ERROR'
        }
      };
    }
  }

  @ApiOperation({ 
    summary: 'Test database connection', 
    description: 'Verifies that the connection details are valid and can establish a connection'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Database connection successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Connection successful' }
      }
    }
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Database connection failed'
  })
  @Post('test-connection')
  async testConnection(@Body() connectionDetails: Omit<AskRequestDto, 'prompt'>) {
    const { type } = connectionDetails;

    if (!type) {
      throw new BadRequestException('Missing type in request body');
    }

    this.logger.log(`Testing database connection for type: ${connectionDetails.type}`);
    
    try {
      const connection = await this.databaseService.connect(
        connectionDetails.username,
        connectionDetails.password,
        connectionDetails.connectionString,
        {
          port: connectionDetails.port,
          database: connectionDetails.database,
          type: connectionDetails.type
        }
      );
      
      // If we got this far, connection was successful
      // Close the connection since we're just testing
      await this.databaseService.closeConnection(connection);
      
      return {
        success: true,
        message: 'Connection successful'
      };
    } catch (error) {
      this.logger.error(`Connection test failed: ${error.message}`);
      
      return {
        success: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }
  
  @ApiOperation({ 
    summary: 'Test Oracle client initialization', 
    description: 'Verifies that the Oracle client is properly initialized and can establish connections'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Oracle client is properly initialized',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Oracle client initialized successfully' }
      }
    }
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Oracle client initialization failed'
  })
  @Get('test-oracle')
  async testOracleConnection() {
    try {
      // Create a simple test connection with placeholder credentials
      // This just tests if Oracle client is properly initialized
      const testConfig = {
        username: 'test_user',
        password: 'test_password',
        connectionString: 'localhost:1521/test',
        options: {
          port: 1521,
          type: 'oracle'
        }
      };
      
      try {
        // This will fail because credentials are invalid, but we just want to test initialization
        await this.databaseService.connect(
          testConfig.username,
          testConfig.password,
          testConfig.connectionString,
          testConfig.options
        );
      } catch (connectionError) {
        // Expected to fail with invalid credentials
        // Check if it's an Oracle initialization error or connection error
        if (connectionError.message.includes('NJS-041') || 
            connectionError.message.includes('cannot load OCI') ||
            connectionError.message.includes('ORA-12154')) {
          throw new Error('Oracle client initialization failed: ' + connectionError.message);
        }
        
        // If it's just a connection error, that's actually good - it means the client initialized
        this.logger.log('Oracle client is properly initialized');
      }
      
      return { 
        success: true, 
        message: 'Oracle client initialized successfully'
      };
    } catch (error) {
      this.logger.error(`Error testing Oracle connection: ${error.message}`);
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: error.message,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  
  @ApiOperation({ 
    summary: 'Get suggested prompts', 
    description: 'Returns a list of suggested prompts that can be used with the database'
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully generated suggested prompts',
    schema: {
      type: 'object',
      properties: {
        suggestedPrompts: { 
          type: 'array', 
          items: { type: 'string' },
          example: ['Show me all tables', 'List employees by department', 'Find customers with highest orders'] 
        }
      }
    }
  })
  @Get('suggestions')
  async getSuggestedPrompts(): Promise<{ suggestedPrompts: string[] }> {
    try {
      // Return default suggested prompts that work with most databases
      return {
        suggestedPrompts: [
          'Show me all tables in this database',
          'List the columns in the employees table',
          'What is the average salary by department?',
          'Show top 10 orders by value',
          'Count of customers by country',
          'Find employees who earn more than the average salary',
          'What are the foreign key relationships in this database?',
          'Show tables with their row counts',
          'List all indexes in the database',
          'Find duplicate records in a table'
        ]
      };
    } catch (error) {
      this.logger.error(`Error generating suggestions: ${error.message}`);
      throw new HttpException(
        `Error generating suggestions: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  
  @ApiOperation({ 
    summary: 'Test generating suggested prompts', 
    description: 'Tests the suggested prompts feature without requiring a database connection'
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully generated suggested prompts',
    type: AskResponseDto
  })
  @Get('test-suggestions')
  async testSuggestions(): Promise<AskResponseDto> {
    try {
      // Create mock data to test the suggestions feature
      const prompt = "Show me tables in this database";
      const executedQueries = [
        "SELECT owner, table_name, num_rows FROM all_tables WHERE ROWNUM <= 10"
      ];
      const results = [
        [
          { "OWNER": "HR", "TABLE_NAME": "EMPLOYEES", "NUM_ROWS": 107 },
          { "OWNER": "HR", "TABLE_NAME": "DEPARTMENTS", "NUM_ROWS": 27 },
          { "OWNER": "HR", "TABLE_NAME": "JOBS", "NUM_ROWS": 19 },
          { "OWNER": "SCOTT", "TABLE_NAME": "EMP", "NUM_ROWS": 14 },
          { "OWNER": "SCOTT", "TABLE_NAME": "DEPT", "NUM_ROWS": 4 }
        ]
      ];
      const schemaData = {
        database: {
          type: 'Oracle',
          name: 'ORCL',
          currentUser: 'TEST_USER'
        },
        tables: [
          {
            owner: 'HR',
            tableName: 'EMPLOYEES',
            columns: [
              { COLUMN_NAME: 'EMPLOYEE_ID', DATA_TYPE: 'NUMBER' },
              { COLUMN_NAME: 'FIRST_NAME', DATA_TYPE: 'VARCHAR2' },
              { COLUMN_NAME: 'LAST_NAME', DATA_TYPE: 'VARCHAR2' },
              { COLUMN_NAME: 'EMAIL', DATA_TYPE: 'VARCHAR2' },
              { COLUMN_NAME: 'PHONE_NUMBER', DATA_TYPE: 'VARCHAR2' }
            ]
          },
          {
            owner: 'HR',
            tableName: 'DEPARTMENTS',
            columns: [
              { COLUMN_NAME: 'DEPARTMENT_ID', DATA_TYPE: 'NUMBER' },
              { COLUMN_NAME: 'DEPARTMENT_NAME', DATA_TYPE: 'VARCHAR2' },
              { COLUMN_NAME: 'MANAGER_ID', DATA_TYPE: 'NUMBER' },
              { COLUMN_NAME: 'LOCATION_ID', DATA_TYPE: 'NUMBER' }
            ]
          }
        ],
        relationships: [
          {
            type: 'Foreign Key',
            source: {
              schema: 'HR',
              table: 'EMPLOYEES',
              column: 'DEPARTMENT_ID'
            },
            target: {
              schema: 'HR',
              table: 'DEPARTMENTS',
              column: 'DEPARTMENT_ID'
            }
          }
        ]
      };
      
      // Generate summary for the mock results
      this.logger.log('Generating summary for test data...');
      const summary = "The database contains tables from the HR and SCOTT schemas. The HR schema has EMPLOYEES (107 rows), DEPARTMENTS (27 rows), and JOBS (19 rows) tables. The SCOTT schema has EMP (14 rows) and DEPT (4 rows) tables.";
      
      // Generate suggested prompts using our real OpenAI service
      this.logger.log('Generating suggested follow-up prompts for test data...');
      const suggestedPrompts = await this.askService.testGenerateSuggestions(
        prompt,
        executedQueries,
        results,
        schemaData
      );
      
      // Return full response object
      return {
        result: summary,
        executedQueries: executedQueries,
        rawResults: results,
        suggestedPrompts: suggestedPrompts
      };
    } catch (error) {
      this.logger.error(`Error in test-suggestions endpoint: ${error.message}`);
      throw new HttpException(
        `Error generating suggestions: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}