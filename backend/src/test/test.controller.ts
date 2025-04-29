import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';

@ApiTags('test')
@Controller('test')
export class TestController {
  private readonly logger = new Logger(TestController.name);
  
  constructor(private readonly databaseService: DatabaseService) {}
  
  @Get('oracle')
  @ApiOperation({ summary: 'Test Oracle database connection' })
  @ApiResponse({
    status: 200,
    description: 'Connection test successful',
  })
  async testOracleConnection() {
    try {
      this.logger.log('Testing Oracle database connection');
      
      // Use the test credentials
      const username = 'monitx';
      const password = 'teste';
      const connectionString = 'monitdb-dev.ddns.net:1521/orcl';
      
      // Attempt to connect with a short timeout
      let connection = null;
      
      try {
        // Connect to the Oracle database with the multi-database provider architecture
        this.logger.log('Connecting to Oracle database for test...');
        connection = await this.databaseService.connect(
          username,
          password,
          connectionString,
          { 
            port: 1521,
            type: 'oracle'
          }
        );
        this.logger.log('Successfully connected to the database');
        
        // Execute a simple query
        const simpleQuery = `SELECT owner, table_name FROM all_tables WHERE ROWNUM <= 5 ORDER BY owner, table_name`;
        const result = await this.databaseService.executeQuery(connection, simpleQuery, 5000);
        
        this.logger.log(`Query executed, got ${result.length} results`);
        
        // Return success with table info
        return {
          success: true,
          message: 'Successfully connected to Oracle database',
          tables: result.map(row => `${row.OWNER}.${row.TABLE_NAME}`),
        };
      } finally {
        // Always close the connection if it was opened
        if (connection) {
          try {
            await this.databaseService.closeConnection(connection);
            this.logger.log('Test connection closed successfully');
          } catch (err) {
            this.logger.error(`Error closing test connection: ${err.message}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Oracle connection test failed: ${error.message}`);
      
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
        error: error.message,
      };
    }
  }
}