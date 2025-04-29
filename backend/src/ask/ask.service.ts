import { Injectable, Logger } from '@nestjs/common';
import { AskRequestDto } from './dto/ask-request.dto';
import { AskResponseDto } from './dto/ask-response.dto';
import { DatabaseService } from '../database/database.service';
import { OpenaiService } from '../openai/openai.service';
import * as oracledb from 'oracledb';
import { safelySerializable } from '../utils/serialize.util';

@Injectable()
export class AskService {
  private readonly logger = new Logger(AskService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly openaiService: OpenaiService,
  ) {}

  /**
   * Process a natural language query against any supported database
   * Optimized implementation that works with any schema and database type
   */
  async processQuery(askRequestDto: AskRequestDto): Promise<AskResponseDto> {
    const { username, password, connectionString, port, prompt, database, type, schema } = askRequestDto;
    
    let connection = null;
    
    try {
      // Standardize database type from request 
      let dbType = (type || 'oracle').toLowerCase(); // Default to Oracle for backward compatibility
      
      // Normalize PostgreSQL type variations
      if (dbType === 'postgres' || dbType === 'postgresql') {
        dbType = 'postgresql'; // Standardize to full name
      }
      
      // Connect to the database
      this.logger.log(`Connecting to ${dbType} database...`);
      connection = await this.databaseService.connect(
        username,
        password,
        connectionString,
        { 
          port, 
          type: dbType,
          database: database // For databases that require a database name like PostgreSQL
        },
      );
      this.logger.log('Connected to database successfully');
      
      // Use smart schema detection and scanning
      this.logger.log('Starting efficient schema discovery and scanning...');
      
      // Log if user specified a schema to focus on
      if (schema) {
        this.logger.log(`User specified schema to focus on: ${schema}`);
      }
      
      // Get current user based on database type
      let currentUser = '';
      
      try {
        if (dbType === 'oracle') {
          const currentUserQuery = "SELECT SYS_CONTEXT('USERENV', 'SESSION_USER') AS CURRENT_USER FROM dual";
          const currentUserResult = await this.databaseService.executeQuery(connection, currentUserQuery, 3000);
          currentUser = currentUserResult[0]?.CURRENT_USER || '';
        } else if (dbType === 'postgresql' || dbType === 'postgres') {
          const currentUserQuery = "SELECT current_user AS current_user";
          const currentUserResult = await this.databaseService.executeQuery(connection, currentUserQuery, 3000);
          currentUser = currentUserResult[0]?.current_user || '';
        } else if (dbType.toLowerCase() === 'mysql') {
          // Try different MySQL syntax variants for getting current user
          let currentUserResult = null;
          
          // Array of possible MySQL user queries with different syntax
          const userQueries = [
            "SELECT USER() AS user",
            "SELECT CURRENT_USER AS user",
            "SELECT SESSION_USER() AS user",
            "SELECT SYSTEM_USER() AS user"
          ];
          
          // Try each query until one works
          for (const query of userQueries) {
            try {
              currentUserResult = await this.databaseService.executeQuery(connection, query, 3000);
              if (currentUserResult && currentUserResult.length > 0) {
                const row = currentUserResult[0];
                // Extract the raw user value
                let userValue = row.user || row.USER || '';
                
                // Clean up MySQL user name by removing the host part (e.g., 'user@host' becomes 'user')
                if (userValue && userValue.includes('@')) {
                  currentUser = userValue.split('@')[0];
                  this.logger.log(`Retrieved MySQL user with host info: ${userValue}, using cleaned username: ${currentUser}`);
                } else {
                  currentUser = userValue;
                  this.logger.log(`Successfully retrieved MySQL user with query: ${query}`);
                }
                
                if (currentUser) {
                  break;
                }
              }
            } catch (queryError) {
              // If this query fails, try the next one
              this.logger.debug(`MySQL user query failed: ${query}, trying next option`);
            }
          }
          
          // If all queries fail, set to empty string
          if (!currentUser) {
            currentUser = '';
          }
        } else if (dbType.toLowerCase() === 'mssql' || dbType.toLowerCase() === 'sqlserver') {
          // SQL Server has special syntax for getting the current user
          try {
            // Try using USER_NAME() function without the AS keyword which may cause syntax issues
            const userNameQuery = "SELECT USER_NAME() user_name";
            const userNameResult = await this.databaseService.executeQuery(connection, userNameQuery, 3000);
            currentUser = userNameResult[0]?.user_name || '';
            
            if (!currentUser) {
              // Try a different approach using SUSER_NAME()
              const suserQuery = "SELECT SUSER_NAME() login_name";
              const suserResult = await this.databaseService.executeQuery(connection, suserQuery, 3000);
              currentUser = suserResult[0]?.login_name || '';
            }
          } catch (error) {
            // Last resort fallback - try with different syntax (without AS keyword)
            try {
              const loginQuery = "SELECT ORIGINAL_LOGIN() login_name";
              const loginResult = await this.databaseService.executeQuery(connection, loginQuery, 3000);
              currentUser = loginResult[0]?.login_name || '';
            } catch (innerError) {
              this.logger.warn(`Could not get SQL Server user: ${innerError.message}`);
              
              // If connection info is available, extract username from there
              if (connection.config && connection.config.user) {
                currentUser = connection.config.user;
                this.logger.log(`Using connection config username: ${currentUser}`);
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Could not determine current user: ${error.message}`);
      }
      
      this.logger.log(`Connected as user: ${currentUser}`);
      
      // Detect available schemas - prioritize user's schema and commonly used ones
      const schemaData = await this.getSmartSchemaInfo(connection, currentUser, schema);
      
      this.logger.log(`Scanned ${schemaData.processedSchemas} schemas with ${schemaData.tables.length} tables`);
      
      // Translate natural language to SQL using OpenAI with the schema data
      this.logger.log('Translating natural language to SQL using database schema information...');
      let sqlQueries = [];
      
      // Don't use fallbacks or workarounds - just get the plain data
      sqlQueries = await this.openaiService.translateToSql(prompt, schemaData);
      this.logger.log(`Generated ${sqlQueries.length} SQL queries`);
      
      // Log each generated query for debugging
      sqlQueries.forEach((query, index) => {
        this.logger.log(`Query ${index + 1}: ${query}`);
      });
      
      // Validate SQL queries for safety
      const safeQueries = sqlQueries.filter(query => 
        this.databaseService.isSafeSqlQuery(query)
      );
      
      if (safeQueries.length < sqlQueries.length) {
        this.logger.warn(`${sqlQueries.length - safeQueries.length} queries were filtered for safety`);
      }
      
      // Execute safe SQL queries
      this.logger.log('Executing SQL queries...');
      const results = [];
      
      for (const query of safeQueries) {
        this.logger.log(`Executing query: ${query}`);
        // Increase timeout to 30 seconds per query for more complex operations
        const queryResult = await this.databaseService.executeQuery(connection, query, 30000);
        results.push(queryResult);
      }
      
      // Generate summary of results using OpenAI with error handling
      this.logger.log('Generating summary of results...');
      let summary = '';
      let suggestedPrompts = [];
      let errorInfo = null;
      
      try {
        summary = await this.openaiService.generateSummary(prompt, safeQueries, results);
        
        // Generate suggested follow-up prompts
        this.logger.log('Generating suggested follow-up prompts...');
        try {
          suggestedPrompts = await this.openaiService.generatePromptSuggestions(
            prompt, 
            safeQueries, 
            results,
            schemaData
          );
        } catch (suggestionsError) {
          this.logger.warn(`Failed to generate suggestions: ${suggestionsError.message}`);
          // Provide fallback suggestions
          suggestedPrompts = [
            "What tables are available in this database?",
            "Show me the structure of the main tables",
            "What relationships exist between the tables?"
          ];
        }
      } catch (summaryError) {
        // Handle rate limit errors gracefully
        this.logger.warn(`Summary generation failed: ${summaryError.message}`);
        
        // Create a fallback summary with the data we have
        if (results.length > 0) {
          const tableNames = safeQueries
            .map(q => {
              // Try to extract table name from the query using regex
              const match = q.match(/FROM\s+([A-Za-z0-9_$.]+)/i);
              return match ? match[1] : null;
            })
            .filter(Boolean); // Remove nulls
            
          const rowCounts = results.map(result => 
            Array.isArray(result) ? result.length : 'unknown'
          );
          
          // Create a basic summary
          summary = `Query executed successfully. Retrieved data from ${tableNames.length} tables. `;
          
          // Add information about the largest result sets
          const largestResults = rowCounts
            .map((count, index) => ({ count: count === 'unknown' ? 0 : count as number, index }))
            .filter(item => item.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);
            
          if (largestResults.length > 0) {
            summary += 'The largest result sets were: ';
            largestResults.forEach((item, i) => {
              const tableName = tableNames[item.index] || `Query ${item.index + 1}`;
              summary += `${tableName} (${item.count} rows)${i < largestResults.length - 1 ? ', ' : '.'}`;
            });
          }
          
          // Add note about the error
          if (summaryError.message.includes('429') || 
              summaryError.message.includes('rate limit') || 
              summaryError.message.includes('token')) {
            summary += `\n\nNote: The data retrieved was too large for AI processing. This is a simplified summary. You can try a more specific query to get detailed analysis.`;
          } else {
            summary += `\n\nNote: Unable to generate detailed summary due to an error: ${summaryError.message}`;
          }
        } else {
          summary = `No results were obtained from the database. Error: ${summaryError.message}`;
        }
        
        // Also set fallback suggestions
        suggestedPrompts = [
          "Try a more specific query focused on fewer tables",
          "Show me the structure of a specific table",
          "What are the relationships between specific tables?"
        ];
        
        // Set error information for the client
        errorInfo = {
          error: true,
          message: summaryError.message,
          type: summaryError.message.includes('429') ? 'RATE_LIMIT_EXCEEDED' : 'SUMMARY_GENERATION_ERROR'
        };
      }
      
      // Use our safe serialization to handle any circular references
      return {
        result: summary,
        executedQueries: safeQueries,
        rawResults: safelySerializable(results),
        suggestedPrompts: suggestedPrompts,
        errorInfo // Include error info if there was a problem
      };
    } catch (error) {
      this.logger.error(`Error processing natural language query: ${error.message}`);
      throw error;
    } finally {
      // Close database connection
      if (connection) {
        try {
          await this.databaseService.closeConnection(connection);
          this.logger.log('Database connection closed');
        } catch (err) {
          this.logger.error(`Error closing database connection: ${err.message}`);
        }
      }
    }
  }
  
  /**
   * Smart schema discovery and scanning for any database type
   * This implementation automatically detects and prioritizes schemas based on:
   * 1. User's own schema
   * 2. Commonly used application schemas (like HR, SCOTT, etc.)
   * 3. Schemas with manageable number of tables
   */
  private async getSmartSchemaInfo(connection: any, currentUser: string, userSpecifiedSchema?: string): Promise<any> {
    // Determine database type from connection
    let dbType = 'Oracle'; // Default
    let dbName = 'Unknown';
    
    try {
      // First, check if we have a postgres client
      if (connection.database && connection.database.endsWith('postgres') || 
          (connection.connectionParameters && connection.connectionParameters.database === 'postgres')) {
        dbType = 'PostgreSQL';
        const dbInfoQuery = `SELECT current_database() as db_name`;
        try {
          const dbInfoResult = await this.databaseService.executeQuery(connection, dbInfoQuery, 3000);
          dbName = dbInfoResult[0]?.db_name || 'Unknown';
        } catch (error) {
          this.logger.warn(`Error determining PostgreSQL database name: ${error.message}`);
          dbName = 'postgres'; // Default fallback
        }
      }
      // Then check for Oracle
      else if (connection.oracleServerVersion) {
        dbType = 'Oracle';
        // Get database name for Oracle
        const dbInfoQuery = `SELECT SYS_CONTEXT('USERENV', 'DB_NAME') as DB_NAME FROM dual`;
        const dbInfoResult = await this.databaseService.executeQuery(connection, dbInfoQuery, 3000);
        dbName = dbInfoResult[0]?.DB_NAME || 'Unknown';
      } 
      // Then check for PostgreSQL using pg-specific properties
      else if (connection.serverVersion && connection.pgVersion) {
        // PostgreSQL connection
        dbType = 'PostgreSQL';
        const dbInfoQuery = `SELECT current_database() as db_name`;
        const dbInfoResult = await this.databaseService.executeQuery(connection, dbInfoQuery, 3000);
        dbName = dbInfoResult[0]?.db_name || 'Unknown';
      } else if (connection.config && connection.config.server) {
        // MSSQL connection - Check this BEFORE MySQL to avoid misidentification
        // since SQL Server connection objects have a .server property
        dbType = 'MSSQL';
        
        // Try multiple approaches for SQL Server database name detection
        let dbNameFound = false;
        
        // First try: DB_NAME() function
        try {
          const dbNameQuery = `SELECT DB_NAME() AS db_name`;
          const dbNameResult = await this.databaseService.executeQuery(connection, dbNameQuery, 3000);
          if (dbNameResult && dbNameResult.length > 0 && dbNameResult[0].db_name) {
            dbName = dbNameResult[0].db_name;
            dbNameFound = true;
            this.logger.log(`SQL Server database name from DB_NAME(): ${dbName}`);
          }
        } catch (error) {
          this.logger.warn(`Could not get database name with DB_NAME(): ${error.message}`);
        }
        
        // Second try: Use sys.databases (if first attempt failed)
        if (!dbNameFound) {
          try {
            const sysDbQuery = `SELECT name FROM sys.databases WHERE database_id = DB_ID()`;
            const sysDbResult = await this.databaseService.executeQuery(connection, sysDbQuery, 3000);
            if (sysDbResult && sysDbResult.length > 0 && sysDbResult[0].name) {
              dbName = sysDbResult[0].name;
              dbNameFound = true;
              this.logger.log(`SQL Server database name from sys.databases: ${dbName}`);
            }
          } catch (error) {
            this.logger.warn(`Could not get database name from sys.databases: ${error.message}`);
          }
        }
        
        // Third try: Use connection string info
        if (!dbNameFound && connection.config.database) {
          dbName = connection.config.database;
          this.logger.log(`Using connection config database name: ${dbName}`);
        }
      } else if (connection.config && connection.config.database) {
        // MySQL connection typically has config.database
        dbType = 'MySQL';
        dbName = connection.config.database;
        
        // Confirm with a query
        try {
          const dbInfoQuery = `SELECT DATABASE() as db_name`;
          const dbInfoResult = await this.databaseService.executeQuery(connection, dbInfoQuery, 3000);
          if (dbInfoResult[0]?.db_name) {
            dbName = dbInfoResult[0].db_name;
          }
        } catch (error) {
          this.logger.warn(`Could not get MySQL database name: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Could not determine database type/name: ${error.message}`);
    }
    
    // Initialize schema data with database info
    const schemaData = {
      database: {
        type: dbType,
        name: dbName,
        currentUser: currentUser
      },
      tableCount: 0,
      processedTables: 0,
      processedSchemas: 0,
      tables: [],
      relationships: []
    };
    
    try {
      // Step 1: Detect schemas based on database type
      let schemas = [];
      try {
        let schemasQuery = '';
        
        // Different query depending on database type
        if (dbType === 'Oracle') {
          schemasQuery = `
            SELECT DISTINCT owner FROM all_tables
            WHERE owner NOT IN ('SYS', 'SYSTEM', 'MDSYS', 'CTXSYS', 'DBSNMP', 'OUTLN', 'XDB', 'APEX_040200', 'WMSYS')
            ORDER BY owner
          `;
          const schemaResults = await this.databaseService.executeQuery(connection, schemasQuery, 5000);
          schemas = schemaResults.map(s => s.OWNER);
        } 
        // Note: PostgreSQL schema handling is in a separate else-if block below, this if block is only for Oracle
        else if (dbType === 'MSSQL') {
          // For SQL Server, we need to handle schema detection special
          let mssqlSchemas = [];
          let success = false;
          
          // Try INFORMATION_SCHEMA first as it's most widely supported
          try {
            const infoSchemaQuery = `
              SELECT DISTINCT TABLE_SCHEMA AS schema_name
              FROM INFORMATION_SCHEMA.TABLES
              WHERE TABLE_TYPE = 'BASE TABLE'
              ORDER BY TABLE_SCHEMA
            `;
            const infoSchemaResults = await this.databaseService.executeQuery(connection, infoSchemaQuery, 5000);
            mssqlSchemas = infoSchemaResults.map(s => s.schema_name);
            
            if (mssqlSchemas.length > 0) {
              success = true;
              this.logger.log(`Found ${mssqlSchemas.length} schemas using INFORMATION_SCHEMA`);
            }
          } catch (error) {
            this.logger.warn(`Failed to get schema list using INFORMATION_SCHEMA: ${error.message}`);
          }
          
          // If that failed, try sys.schemas
          if (!success) {
            try {
              const sysQuery = `
                SELECT DISTINCT s.name AS schema_name
                FROM sys.schemas s
                INNER JOIN sys.tables t ON t.schema_id = s.schema_id
                WHERE s.name NOT IN ('sys', 'guest', 'INFORMATION_SCHEMA')
                ORDER BY s.name
              `;
              const sysResults = await this.databaseService.executeQuery(connection, sysQuery, 5000);
              mssqlSchemas = sysResults.map(s => s.schema_name);
              
              if (mssqlSchemas.length > 0) {
                success = true;
                this.logger.log(`Found ${mssqlSchemas.length} schemas using sys.schemas`);
              }
            } catch (error) {
              this.logger.warn(`Failed to get schema list using sys.schemas: ${error.message}`);
            }
          }
          
          // Last resort, try individual schemas we know exist in SQL Server
          if (!success || mssqlSchemas.length === 0) {
            // Default schemas that often exist in SQL Server
            const defaultSchemas = ['dbo', 'guest', 'APPLICATION', 'SOLUTION'];
            
            // Try to validate each default schema by checking if it has any tables
            for (const defaultSchema of defaultSchemas) {
              try {
                const schemaCheckQuery = `
                  SELECT COUNT(*) AS table_count 
                  FROM INFORMATION_SCHEMA.TABLES 
                  WHERE TABLE_SCHEMA = '${defaultSchema}'
                `;
                const checkResult = await this.databaseService.executeQuery(connection, schemaCheckQuery, 3000);
                
                if (checkResult[0]?.table_count > 0) {
                  mssqlSchemas.push(defaultSchema);
                  this.logger.log(`Found valid schema: ${defaultSchema}`);
                }
              } catch (error) {
                // Ignore errors here
              }
            }
          }
          
          // Ensure we have at least 'dbo' which is the default schema in SQL Server
          if (mssqlSchemas.length === 0) {
            mssqlSchemas = ['dbo'];
            this.logger.log('No schemas found, defaulting to dbo schema');
          }
          
          schemas = mssqlSchemas;
        }
        else if (dbType === 'PostgreSQL') {
          try {
            schemasQuery = `
              SELECT DISTINCT schemaname AS schema_name
              FROM pg_tables
              WHERE schemaname NOT LIKE 'pg_%' AND schemaname != 'information_schema'
              ORDER BY schemaname
            `;
            const schemaResults = await this.databaseService.executeQuery(connection, schemasQuery, 5000);
            schemas = schemaResults.map(s => s.schema_name);
            
            // If no schemas found, default to 'public' which is the standard PostgreSQL schema
            if (schemas.length === 0) {
              schemas = ['public'];
              this.logger.log('No schemas found, defaulting to public schema');
            }
          } catch (error) {
            // Fallback to information_schema query for older PostgreSQL versions
            this.logger.warn(`Error detecting PostgreSQL schemas with pg_tables: ${error.message}`);
            try {
              const backupQuery = `
                SELECT DISTINCT table_schema AS schema_name
                FROM information_schema.tables
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY table_schema
              `;
              const backupResults = await this.databaseService.executeQuery(connection, backupQuery, 5000);
              schemas = backupResults.map(s => s.schema_name);
              
              if (schemas.length === 0) {
                schemas = ['public'];
                this.logger.log('No schemas found in fallback query, defaulting to public schema');
              }
            } catch (fallbackError) {
              this.logger.error(`Error in PostgreSQL schema fallback detection: ${fallbackError.message}`);
              schemas = ['public'];
              this.logger.log('Using default public schema after multiple detection failures');
            }
          }
        }
        else if (dbType === 'MySQL') {
          // MySQL doesn't have schemas in the same way - we can use databases instead
          try {
            schemasQuery = `SHOW DATABASES WHERE \`Database\` NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')`;
            const schemaResults = await this.databaseService.executeQuery(connection, schemasQuery, 5000);
            schemas = schemaResults.map(s => s.Database);
          } catch (error) {
            this.logger.warn(`Error detecting MySQL databases: ${error.message}`);
            // Default to current database
            schemas = [dbName];
          }
        }
        
        this.logger.log(`Found ${schemas.length} non-system schemas: ${schemas.join(', ')}`);
      } catch (error) {
        this.logger.warn(`Error detecting schemas: ${error.message}`);
      }
      
      // If no schemas detected, use appropriate fallbacks based on database type
      if (schemas.length === 0) {
        if (dbType === 'MySQL') {
          // For MySQL, use the current database instead of the username
          if (dbName && dbName !== 'Unknown') {
            schemas = [dbName];
            this.logger.log(`No schemas found, using current database: ${dbName}`);
          } else if (connection.config && connection.config.database) {
            // Last resort fallback, get database from connection config
            schemas = [connection.config.database];
            this.logger.log(`No schemas found, using database from connection config: ${connection.config.database}`);
          } else {
            // If all else fails, use a safe default value that won't error out
            schemas = ['mysql'];
            this.logger.log(`No schemas found and can't identify database, using default: 'mysql'`);
          }
        } else if (currentUser) {
          // For other database types, using currentUser as schema name might work
          schemas = [currentUser];
          this.logger.log(`No schemas found, using current user as schema: ${currentUser}`);
        }
      }
      
      // Step 2: Handle user-specified schema or use smart prioritization
      let prioritizedSchemas = [];
      
      // If user specified a schema, use only that one
      if (userSpecifiedSchema) {
        // For PostgreSQL, always add 'public' schema as a fallback
        if (dbType === 'PostgreSQL' && !schemas.includes('public')) {
          schemas.push('public');
        }

        // Check if the specified schema exists in the database
        const specifiedSchemaExists = schemas.some(
          s => s.toLowerCase() === userSpecifiedSchema.toLowerCase()
        );
        
        if (specifiedSchemaExists) {
          // Use only the user-specified schema
          const exactMatchSchema = schemas.find(
            s => s.toLowerCase() === userSpecifiedSchema.toLowerCase()
          );
          prioritizedSchemas = [exactMatchSchema];
          this.logger.log(`Using only user-specified schema: ${exactMatchSchema}`);
        } else {
          this.logger.warn(`User-specified schema '${userSpecifiedSchema}' not found, falling back to automatic schema detection`);
          // Fall back to automatic prioritization
          prioritizeSchemasInline(schemas, currentUser, prioritizedSchemas);
        }
      } else {
        // No user-specified schema, use automatic prioritization
        prioritizeSchemasInline(schemas, currentUser, prioritizedSchemas);
      }
      
      // Local helper function to prioritize schemas
      function prioritizeSchemasInline(
        schemasList: string[], 
        userIdentity: string, 
        priorityList: string[]
      ): void {
        const commonSchemas = ['HR', 'SCOTT', 'DEMO', 'APP', 'USERS', 'CUSTOMER', 'PRODUCT', 'dbo', 'APPLICATION', 'HISTORIC', 'SOL'];
        
        // Current user schema first
        if (userIdentity && schemasList.includes(userIdentity)) {
          priorityList.push(userIdentity);
        }
        
        // Common schemas next
        commonSchemas.forEach(schemaName => {
          const foundSchema = schemasList.find(s => s.toUpperCase() === schemaName.toUpperCase());
          if (foundSchema && !priorityList.includes(foundSchema)) {
            priorityList.push(foundSchema);
          }
        });
        
        // Add remaining schemas
        schemasList.forEach(schemaName => {
          if (!priorityList.includes(schemaName)) {
            priorityList.push(schemaName);
          }
        });
      }
      
      // Step 3: Process selected schemas with stricter limits
      const MAX_SCHEMAS = userSpecifiedSchema ? 1 : 10; // Use just 1 schema if specified by user, otherwise 10
      const MAX_TABLES_PER_SCHEMA = userSpecifiedSchema ? 100 : 30; // Allow more tables when focusing on a single schema
      const MAX_COLUMNS_PER_TABLE = 100; // New limit on columns
      const MAX_SAMPLE_ROWS = 30; // Reduced sample data
      let processedSchemas = 0;
      let totalProcessedTables = 0;
      
      for (const schema of prioritizedSchemas) {
        if (processedSchemas >= MAX_SCHEMAS) {
          break;
        }
        
        try {
          // Get tables in this schema - query varies by database type
          let tablesQuery = '';
          let tablesResult = [];
          
          if (dbType === 'Oracle') {
            tablesQuery = `
              SELECT table_name FROM all_tables 
              WHERE owner = '${schema}' 
              ORDER BY table_name
            `;
            tablesResult = await this.databaseService.executeQuery(connection, tablesQuery, 5000);
          } 
          else if (dbType === 'MSSQL') {
            // SQL Server - try both methods for maximum compatibility
            try {
              // Try using sys.tables with schema join first
              tablesQuery = `
                SELECT t.name AS table_name 
                FROM sys.tables t
                INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
                WHERE s.name = '${schema}'
                ORDER BY t.name
              `;
              tablesResult = await this.databaseService.executeQuery(connection, tablesQuery, 5000);
              
              if (tablesResult.length === 0) {
                // Try INFORMATION_SCHEMA as a backup
                const infoSchemaTablesQuery = `
                  SELECT TABLE_NAME AS table_name
                  FROM INFORMATION_SCHEMA.TABLES
                  WHERE TABLE_SCHEMA = '${schema}'
                  AND TABLE_TYPE = 'BASE TABLE'
                  ORDER BY TABLE_NAME
                `;
                tablesResult = await this.databaseService.executeQuery(connection, infoSchemaTablesQuery, 5000);
              }
            } catch (error) {
              // Fallback to INFORMATION_SCHEMA which is more portable
              const infoSchemaBackupQuery = `
                SELECT TABLE_NAME AS table_name
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = '${schema}'
                AND TABLE_TYPE = 'BASE TABLE'
                ORDER BY TABLE_NAME
              `;
              tablesResult = await this.databaseService.executeQuery(connection, infoSchemaBackupQuery, 5000);
            }
          }
          else if (dbType === 'PostgreSQL') {
            tablesQuery = `
              SELECT tablename AS table_name 
              FROM pg_tables 
              WHERE schemaname = '${schema}'
              ORDER BY tablename
            `;
            tablesResult = await this.databaseService.executeQuery(connection, tablesQuery, 5000);
          }
          else if (dbType === 'MySQL') {
            tablesQuery = `
              SHOW TABLES FROM \`${schema}\`
            `;
            tablesResult = await this.databaseService.executeQuery(connection, tablesQuery, 5000);
            // MySQL returns results with a dynamic column name like 'Tables_in_dbname'
            // Transform to a consistent format
            const columnName = Object.keys(tablesResult[0] || {})[0];
            tablesResult = tablesResult.map(row => ({
              table_name: row[columnName]
            }));
          }
          
          if (tablesResult.length === 0) {
            continue; // Skip this schema if no tables
          }
          
          this.logger.log(`Schema ${schema} has ${tablesResult.length} tables`);
          schemaData.tableCount += tablesResult.length;
          
          // Select a subset of tables to process
          const tablesToProcess = tablesResult.slice(0, MAX_TABLES_PER_SCHEMA);
          
          // Process each table
          for (const table of tablesToProcess) {
            const tableName = table.table_name || table.TABLE_NAME;
            this.logger.log(`Getting metadata for ${schema}.${tableName}`);
            
            // Get columns based on database type
            let columnsQuery = '';
            let columnsResult = [];
            
            if (dbType === 'Oracle') {
              columnsQuery = `
                SELECT column_name, data_type, data_length, nullable, column_id
                FROM all_tab_columns 
                WHERE owner = '${schema}' AND table_name = '${tableName}'
                ORDER BY column_id
              `;
              columnsResult = await this.databaseService.executeQuery(connection, columnsQuery, 5000);
            } 
            else if (dbType === 'MSSQL') {
              try {
                // Try sys.columns first
                columnsQuery = `
                  SELECT 
                    c.name AS column_name, 
                    t.name AS data_type,
                    c.max_length AS data_length,
                    c.precision AS data_precision,
                    c.scale AS data_scale,
                    c.is_nullable AS nullable,
                    c.column_id
                  FROM 
                    sys.columns c
                    INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
                    INNER JOIN sys.tables tbl ON c.object_id = tbl.object_id
                    INNER JOIN sys.schemas s ON tbl.schema_id = s.schema_id
                  WHERE 
                    s.name = '${schema}' 
                    AND tbl.name = '${tableName}'
                  ORDER BY 
                    c.column_id
                `;
                columnsResult = await this.databaseService.executeQuery(connection, columnsQuery, 5000);
              } catch (error) {
                // Fallback to INFORMATION_SCHEMA which is more broadly supported
                this.logger.log(`Falling back to INFORMATION_SCHEMA for column info: ${error.message}`);
                columnsQuery = `
                  SELECT 
                    COLUMN_NAME AS column_name,
                    DATA_TYPE AS data_type,
                    CHARACTER_MAXIMUM_LENGTH AS data_length,
                    NUMERIC_PRECISION AS data_precision,
                    NUMERIC_SCALE AS data_scale, 
                    IS_NULLABLE AS nullable,
                    ORDINAL_POSITION AS column_id
                  FROM 
                    INFORMATION_SCHEMA.COLUMNS
                  WHERE 
                    TABLE_SCHEMA = '${schema}'
                    AND TABLE_NAME = '${tableName}'
                  ORDER BY 
                    ORDINAL_POSITION
                `;
                columnsResult = await this.databaseService.executeQuery(connection, columnsQuery, 5000);
              }
              
              // Format to match Oracle format
              columnsResult = columnsResult.map(col => ({
                COLUMN_NAME: col.column_name,
                DATA_TYPE: col.data_type,
                DATA_LENGTH: col.data_length,
                DATA_PRECISION: col.data_precision,
                DATA_SCALE: col.data_scale,
                NULLABLE: (col.nullable === 'YES' || col.nullable === true || col.nullable === 1) ? 'Y' : 'N',
                COLUMN_ID: col.column_id
              }));
            }
            else if (dbType === 'PostgreSQL') {
              columnsQuery = `
                SELECT 
                  column_name, 
                  data_type, 
                  character_maximum_length AS data_length,
                  is_nullable AS nullable,
                  ordinal_position AS column_id
                FROM 
                  information_schema.columns
                WHERE 
                  table_schema = '${schema}' 
                  AND table_name = '${tableName}'
                ORDER BY 
                  ordinal_position
              `;
              columnsResult = await this.databaseService.executeQuery(connection, columnsQuery, 5000);
              
              // Format to match Oracle format
              columnsResult = columnsResult.map(col => ({
                COLUMN_NAME: col.column_name,
                DATA_TYPE: col.data_type,
                DATA_LENGTH: col.data_length,
                NULLABLE: col.nullable === 'YES' ? 'Y' : 'N',
                COLUMN_ID: col.column_id
              }));
            }
            else if (dbType === 'MySQL') {
              columnsQuery = `
                SELECT 
                  COLUMN_NAME AS column_name, 
                  DATA_TYPE AS data_type, 
                  CHARACTER_MAXIMUM_LENGTH AS data_length,
                  IS_NULLABLE AS nullable,
                  ORDINAL_POSITION AS column_id
                FROM 
                  INFORMATION_SCHEMA.COLUMNS
                WHERE 
                  TABLE_SCHEMA = '${schema}' 
                  AND TABLE_NAME = '${tableName}'
                ORDER BY 
                  ORDINAL_POSITION
              `;
              columnsResult = await this.databaseService.executeQuery(connection, columnsQuery, 5000);
              
              // Format to match Oracle format
              columnsResult = columnsResult.map(col => ({
                COLUMN_NAME: col.column_name,
                DATA_TYPE: col.data_type,
                DATA_LENGTH: col.data_length,
                NULLABLE: col.nullable === 'YES' ? 'Y' : 'N',
                COLUMN_ID: col.column_id
              }));
            }
            
            // Get primary key based on database type
            let pkQuery = '';
            let pkResult = [];
            let primaryKey = [];
            
            if (dbType === 'Oracle') {
              pkQuery = `
                SELECT cols.column_name
                FROM all_constraints cons, all_cons_columns cols
                WHERE cons.constraint_type = 'P'
                AND cons.table_name = '${tableName}'
                AND cons.owner = '${schema}'
                AND cons.constraint_name = cols.constraint_name
                AND cons.owner = cols.owner
                ORDER BY cols.position
              `;
              pkResult = await this.databaseService.executeQuery(connection, pkQuery, 3000);
              primaryKey = pkResult.map(row => row.COLUMN_NAME);
            }
            else if (dbType === 'MSSQL') {
              try {
                // Try using sys.indexes first
                pkQuery = `
                  SELECT 
                    c.name AS column_name
                  FROM 
                    sys.indexes i
                    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
                    INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                    INNER JOIN sys.tables t ON i.object_id = t.object_id
                    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
                  WHERE 
                    i.is_primary_key = 1
                    AND s.name = '${schema}'
                    AND t.name = '${tableName}'
                  ORDER BY 
                    ic.key_ordinal
                `;
                pkResult = await this.databaseService.executeQuery(connection, pkQuery, 3000);
                if (pkResult.length > 0) {
                  primaryKey = pkResult.map(row => row.column_name);
                } else {
                  throw new Error("No primary key found with sys.indexes");
                }
              } catch (error) {
                try {
                  // Fallback to INFORMATION_SCHEMA which is more broadly supported
                  this.logger.log(`Falling back to INFORMATION_SCHEMA for primary key info: ${error.message}`);
                  pkQuery = `
                    SELECT 
                      kcu.COLUMN_NAME AS column_name
                    FROM 
                      INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                        AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
                    WHERE 
                      tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                      AND tc.TABLE_SCHEMA = '${schema}'
                      AND tc.TABLE_NAME = '${tableName}'
                    ORDER BY 
                      kcu.ORDINAL_POSITION
                  `;
                  pkResult = await this.databaseService.executeQuery(connection, pkQuery, 3000);
                  primaryKey = pkResult.map(row => row.column_name);
                } catch (innerError) {
                  this.logger.warn(`Failed to get primary key info: ${innerError.message}`);
                  // Try to guess primary key by looking for ID columns as a last resort
                  const potentialIdColumns = columnsResult
                    .filter(col => 
                      col.COLUMN_NAME.toLowerCase() === 'id' || 
                      col.COLUMN_NAME.toLowerCase().endsWith('id')
                    )
                    .map(col => col.COLUMN_NAME);
                    
                  if (potentialIdColumns.length > 0) {
                    this.logger.log(`Using heuristic to guess primary key: ${potentialIdColumns[0]}`);
                    primaryKey = [potentialIdColumns[0]];
                  } else {
                    primaryKey = [];
                  }
                }
              }
            }
            else if (dbType === 'PostgreSQL') {
              pkQuery = `
                SELECT 
                  kcu.column_name
                FROM 
                  information_schema.table_constraints tc
                  JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE 
                  tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = '${schema}'
                  AND tc.table_name = '${tableName}'
                ORDER BY 
                  kcu.ordinal_position
              `;
              pkResult = await this.databaseService.executeQuery(connection, pkQuery, 3000);
              primaryKey = pkResult.map(row => row.column_name);
            }
            else if (dbType === 'MySQL') {
              pkQuery = `
                SELECT 
                  COLUMN_NAME AS column_name
                FROM 
                  INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE 
                  CONSTRAINT_NAME = 'PRIMARY'
                  AND TABLE_SCHEMA = '${schema}'
                  AND TABLE_NAME = '${tableName}'
                ORDER BY 
                  ORDINAL_POSITION
              `;
              pkResult = await this.databaseService.executeQuery(connection, pkQuery, 3000);
              primaryKey = pkResult.map(row => row.column_name);
            }
            
            // Get sample data with limited columns and fewer rows
            let sampleData = [];
            let sampleQuery = '';
            
            // Limit columns for sample data to reduce size
            const limitedColumns = columnsResult
              .slice(0, MAX_COLUMNS_PER_TABLE)
              .map(col => col.COLUMN_NAME);
            
            // If we have important columns like IDs or primary keys, make sure they're included
            primaryKey.forEach(pkCol => {
              if (!limitedColumns.includes(pkCol)) {
                limitedColumns.unshift(pkCol); // Add to beginning
                // Keep within limits
                if (limitedColumns.length > MAX_COLUMNS_PER_TABLE) {
                  limitedColumns.pop();
                }
              }
            });
            
            // Create a comma-separated list of column names
            const columnList = limitedColumns.map(colName => {
              // Format column names based on database type syntax
              if (dbType === 'MSSQL') {
                return `[${colName}]`;
              } else if (dbType === 'MySQL') {
                return `\`${colName}\``;
              } else if (dbType === 'Oracle') {
                return `"${colName}"`;
              } else {
                return `"${colName}"`;
              }
            }).join(', ');
            
            // Build sample query with limited columns and rows
            if (dbType === 'Oracle') {
              sampleQuery = `SELECT ${columnList} FROM ${schema}.${tableName} WHERE ROWNUM <= ${MAX_SAMPLE_ROWS}`;
            } 
            else if (dbType === 'MSSQL') {
              sampleQuery = `SELECT TOP ${MAX_SAMPLE_ROWS} ${columnList} FROM [${schema}].[${tableName}]`;
            }
            else if (dbType === 'PostgreSQL') {
              sampleQuery = `SELECT ${columnList} FROM "${schema}"."${tableName}" LIMIT ${MAX_SAMPLE_ROWS}`;
            }
            else if (dbType === 'MySQL') {
              sampleQuery = `SELECT ${columnList} FROM \`${schema}\`.\`${tableName}\` LIMIT ${MAX_SAMPLE_ROWS}`;
            }
            
            try {
              sampleData = await this.databaseService.executeQuery(connection, sampleQuery, 5000);
            } catch (error) {
              this.logger.warn(`Error getting sample data for ${schema}.${tableName}: ${error.message}`);
              sampleData = []; // Empty array if there's an error
            }
            
            // Limit the number of columns in the schema data to reduce size
            const limitedColumnsData = columnsResult.slice(0, MAX_COLUMNS_PER_TABLE);
            
            // Add table info to schema data with limited columns
            schemaData.tables.push({
              owner: schema,
              tableName: tableName,
              columns: limitedColumnsData,
              primaryKey: primaryKey,
              sampleData: sampleData
            });
            
            totalProcessedTables++;
          }
          
          // Get relevant foreign key relationships for this schema based on database type
          if (tablesToProcess.length > 0) {
            let fkQuery = '';
            let fkResult = [];
            
            try {
              // Build list of table names in appropriate format
              const tableNames = tablesToProcess.map(t => {
                const tName = t.table_name || t.TABLE_NAME;
                return `'${tName}'`;
              }).join(',');
              
              if (dbType === 'Oracle') {
                fkQuery = `
                  SELECT 
                    cons.table_name as table_name,
                    cols.column_name as column_name,
                    r_cons.table_name as r_table_name,
                    r_cols.column_name as r_column_name
                  FROM 
                    all_constraints cons
                    JOIN all_cons_columns cols ON cons.constraint_name = cols.constraint_name AND cons.owner = cols.owner
                    JOIN all_constraints r_cons ON cons.r_constraint_name = r_cons.constraint_name AND cons.r_owner = r_cons.owner
                    JOIN all_cons_columns r_cols ON r_cons.constraint_name = r_cols.constraint_name AND r_cons.owner = r_cols.owner
                  WHERE 
                    cons.constraint_type = 'R'
                    AND cons.owner = '${schema}'
                    AND cons.table_name IN (${tableNames})
                `;
                fkResult = await this.databaseService.executeQuery(connection, fkQuery, 5000);
                
                // Process Oracle results
                for (const fk of fkResult) {
                  schemaData.relationships.push({
                    type: 'Foreign Key',
                    source: {
                      schema: schema,
                      table: fk.TABLE_NAME,
                      column: fk.COLUMN_NAME
                    },
                    target: {
                      schema: schema, // Note: could be a different schema
                      table: fk.R_TABLE_NAME,
                      column: fk.R_COLUMN_NAME
                    }
                  });
                }
              } 
              else if (dbType === 'MSSQL') {
                fkQuery = `
                  SELECT
                    ss.name AS source_schema,
                    st.name AS source_table,
                    sc.name AS source_column,
                    ts.name AS target_schema,
                    tt.name AS target_table,
                    tc.name AS target_column
                  FROM 
                    sys.foreign_key_columns fkc
                    INNER JOIN sys.tables st ON fkc.parent_object_id = st.object_id
                    INNER JOIN sys.schemas ss ON st.schema_id = ss.schema_id
                    INNER JOIN sys.columns sc ON fkc.parent_object_id = sc.object_id AND fkc.parent_column_id = sc.column_id
                    INNER JOIN sys.tables tt ON fkc.referenced_object_id = tt.object_id
                    INNER JOIN sys.schemas ts ON tt.schema_id = ts.schema_id
                    INNER JOIN sys.columns tc ON fkc.referenced_object_id = tc.object_id AND fkc.referenced_column_id = tc.column_id
                  WHERE 
                    ss.name = '${schema}'
                    AND st.name IN (${tableNames})
                `;
                fkResult = await this.databaseService.executeQuery(connection, fkQuery, 5000);
                
                // Process SQL Server results
                for (const fk of fkResult) {
                  schemaData.relationships.push({
                    type: 'Foreign Key',
                    source: {
                      schema: fk.source_schema,
                      table: fk.source_table,
                      column: fk.source_column
                    },
                    target: {
                      schema: fk.target_schema, 
                      table: fk.target_table,
                      column: fk.target_column
                    }
                  });
                }
              }
              else if (dbType === 'PostgreSQL') {
                fkQuery = `
                  SELECT
                    kcu.table_schema AS source_schema,
                    kcu.table_name AS source_table, 
                    kcu.column_name AS source_column,
                    ccu.table_schema AS target_schema,
                    ccu.table_name AS target_table,
                    ccu.column_name AS target_column 
                  FROM 
                    information_schema.table_constraints AS tc 
                    JOIN information_schema.key_column_usage AS kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                      ON ccu.constraint_name = tc.constraint_name
                      AND ccu.table_schema = tc.table_schema
                  WHERE 
                    tc.constraint_type = 'FOREIGN KEY'
                    AND kcu.table_schema = '${schema}'
                    AND kcu.table_name IN (${tableNames})
                `;
                fkResult = await this.databaseService.executeQuery(connection, fkQuery, 5000);
                
                // Process PostgreSQL results
                for (const fk of fkResult) {
                  schemaData.relationships.push({
                    type: 'Foreign Key',
                    source: {
                      schema: fk.source_schema,
                      table: fk.source_table,
                      column: fk.source_column
                    },
                    target: {
                      schema: fk.target_schema,
                      table: fk.target_table,
                      column: fk.target_column
                    }
                  });
                }
              }
              else if (dbType === 'MySQL') {
                fkQuery = `
                  SELECT 
                    TABLE_SCHEMA AS source_schema,
                    TABLE_NAME AS source_table,
                    COLUMN_NAME AS source_column,
                    REFERENCED_TABLE_SCHEMA AS target_schema,
                    REFERENCED_TABLE_NAME AS target_table,
                    REFERENCED_COLUMN_NAME AS target_column
                  FROM
                    INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                  WHERE
                    REFERENCED_TABLE_NAME IS NOT NULL
                    AND TABLE_SCHEMA = '${schema}'
                    AND TABLE_NAME IN (${tableNames})
                `;
                fkResult = await this.databaseService.executeQuery(connection, fkQuery, 5000);
                
                // Process MySQL results
                for (const fk of fkResult) {
                  schemaData.relationships.push({
                    type: 'Foreign Key',
                    source: {
                      schema: fk.source_schema,
                      table: fk.source_table,
                      column: fk.source_column
                    },
                    target: {
                      schema: fk.target_schema,
                      table: fk.target_table,
                      column: fk.target_column
                    }
                  });
                }
              }
            } catch (error) {
              this.logger.warn(`Error getting relationships for schema ${schema}: ${error.message}`);
            }
          }
          
          processedSchemas++;
        } catch (error) {
          this.logger.error(`Error processing schema ${schema}: ${error.message}`);
        }
      }
      
      schemaData.processedSchemas = processedSchemas;
      schemaData.processedTables = totalProcessedTables;
      
      // Use our safe serialization to handle any circular references
      return safelySerializable(schemaData);
    } catch (error) {
      this.logger.error(`Error in smart schema discovery: ${error.message}`);
      
      // Return minimal schema info if discovery fails
      return {
        database: {
          type: dbType, // Use the detected database type
          name: dbName,
          currentUser: currentUser
        },
        tableCount: 0,
        processedTables: 0,
        processedSchemas: 0,
        tables: [],
        relationships: []
      };
    }
  }
  
  /**
   * Helper method to prioritize schemas
   * @param schemas List of all available schemas
   * @param currentUser Current database user
   * @param prioritizedSchemas Array to populate with prioritized schemas
   */
  private prioritizeSchemas(
    schemas: string[],
    currentUser: string,
    prioritizedSchemas: string[]
  ): void {
    const commonSchemas = ['HR', 'SCOTT', 'DEMO', 'APP', 'USERS', 'CUSTOMER', 'PRODUCT', 'dbo', 'APPLICATION', 'HISTORIC', 'SOL'];
    
    // Current user schema first
    if (currentUser && schemas.includes(currentUser)) {
      prioritizedSchemas.push(currentUser);
    }
    
    // Common schemas next
    commonSchemas.forEach(schema => {
      const foundSchema = schemas.find(s => s.toUpperCase() === schema.toUpperCase());
      if (foundSchema && !prioritizedSchemas.includes(foundSchema)) {
        prioritizedSchemas.push(foundSchema);
      }
    });
    
    // Add remaining schemas
    schemas.forEach(schema => {
      if (!prioritizedSchemas.includes(schema)) {
        prioritizedSchemas.push(schema);
      }
    });
  }

  /**
   * Test method for generating suggested prompts without database connection
   * This is used by the test-suggestions endpoint
   */
  async testGenerateSuggestions(
    prompt: string,
    executedQueries: string[],
    results: any[],
    schemaData: any
  ): Promise<string[]> {
    try {
      // Use the openAI service directly to generate suggestions
      this.logger.log('Calling OpenAI to generate test suggestions...');
      return await this.openaiService.generatePromptSuggestions(
        prompt,
        executedQueries,
        results,
        schemaData
      );
    } catch (error) {
      this.logger.error(`Error generating test suggestions: ${error.message}`);
      // Return generic suggestions for testing if there's an error
      return [
        "Show me the structure of the EMPLOYEES table",
        "What is the relationship between EMPLOYEES and DEPARTMENTS?",
        "How many employees are in each department?"
      ];
    }
  }
}