import { Logger } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { DatabaseProvider } from '../interfaces/database-provider.interface';

/**
 * MySQL database provider implementation
 */
export class MysqlDatabaseProvider implements DatabaseProvider {
  private readonly logger = new Logger(MysqlDatabaseProvider.name);
  
  /**
   * Connect to a MySQL database
   * @param config Database connection configuration
   * @returns MySQL connection
   */
  async connect(config: any): Promise<mysql.Connection> {
    const { username, password, host, port, database } = config;
    
    this.logger.log(`Connecting to MySQL database: ${host}:${port}/${database}`);
    
    try {
      // Create connection config
      const connectionConfig = {
        user: username,
        password: password,
        host: host,
        port: port,
        database: database,
        // Add optional SSL support
        ssl: config.ssl ? {
          rejectUnauthorized: false // For self-signed certificates
        } : undefined,
        // Add connection timeout
        connectTimeout: 5000
      };
      
      // Create connection
      const connection = await mysql.createConnection(connectionConfig);
      
      // Test the connection
      this.logger.log('Testing connection with a simple query...');
      await connection.query('SELECT 1 AS connection_test');
      this.logger.log('✓ MySQL connection successful');
      
      return connection;
    } catch (error) {
      this.logger.error(`Error connecting to MySQL: ${error.message}`);
      
      // Enhanced error handling with specific diagnostic information
      // MySQL error codes: https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Could not connect to MySQL server at ${host}:${port}. Make sure the server is running and accessible.`);
      }
      if (error.code === 'ETIMEDOUT') {
        throw new Error(`Connection to MySQL server at ${host}:${port} timed out. Check network connectivity and firewall settings.`);
      }
      if (error.code === 'ENOTFOUND') {
        throw new Error(`Host "${host}" not found. Check the hostname and DNS resolution.`);
      }
      
      // MySQL specific error codes
      if (error.errno === 1045) {
        throw new Error(`Access denied for user '${username}'. Check your username and password.`);
      }
      if (error.errno === 1049) {
        throw new Error(`Unknown database '${database}'. The database does not exist on the MySQL server.`);
      }
      if (error.errno === 1044) {
        throw new Error(`Access denied for user '${username}' to database '${database}'. User lacks sufficient privileges.`);
      }
      if (error.errno === 1142) {
        throw new Error(`Permission denied. User '${username}' lacks sufficient privileges for the requested operation.`);
      }
      if (error.errno === 1040) {
        throw new Error(`Too many connections to MySQL server. The server has reached its maximum connection limit.`);
      }
      if (error.errno === 1042) {
        throw new Error(`Unable to connect to MySQL server. The server may be configured to accept connections from specific hosts only.`);
      }
      if (error.errno === 1053) {
        throw new Error(`Server shutdown in progress. The MySQL server is shutting down.`);
      }
      
      // Default error message with more context
      throw new Error(`Failed to connect to MySQL database: ${error.message}. Error code: ${error.code || error.errno || 'unknown'}`);
    }
  }
  
  /**
   * Execute a SQL query on MySQL connection
   * @param connection MySQL connection
   * @param sql SQL query to execute
   * @param timeout Query timeout in milliseconds
   * @returns Query results as array of objects
   */
  async executeQuery(
    connection: mysql.Connection, 
    sql: string, 
    timeout: number = 10000
  ): Promise<any[]> {
    const cleanSql = sql.trim();
    this.logger.log(`Executing MySQL query: ${cleanSql}`);
    
    try {
      // In MySQL, we need to set timeout as a session variable
      await connection.query(`SET SESSION MAX_EXECUTION_TIME = ${Math.floor(timeout)}`);
      
      // Execute the query
      const [rows] = await connection.query(cleanSql);
      
      this.logger.log(`Query executed successfully, rows returned: ${Array.isArray(rows) ? rows.length : 1}`);
      
      // Normalize the result to an array of objects
      return Array.isArray(rows) ? rows : [rows];
    } catch (error) {
      this.logger.error(`Error executing MySQL query: ${error.message}`);
      
      // Enhanced error handling for MySQL query execution
      if (error.errno === 1064) {
        throw new Error(`SQL syntax error in query: ${error.message}`);
      }
      if (error.errno === 1146) {
        throw new Error(`Table doesn't exist: ${error.message}`);
      }
      if (error.errno === 1054) {
        throw new Error(`Unknown column in query: ${error.message}`);
      }
      if (error.errno === 1052) {
        throw new Error(`Column is ambiguous (appears in multiple tables): ${error.message}`);
      }
      if (error.errno === 1109) {
        throw new Error(`Unknown table in query: ${error.message}`);
      }
      if (error.errno === 1142) {
        throw new Error(`Permission denied. Insufficient privileges for this operation: ${error.message}`);
      }
      if (error.errno === 1065) {
        throw new Error(`Query was empty: ${error.message}`);
      }
      if (error.errno === 1205) {
        throw new Error(`Lock wait timeout exceeded. The transaction might have been deadlocked: ${error.message}`);
      }
      if (error.errno === 1213) {
        throw new Error(`Deadlock detected. Try restarting the transaction: ${error.message}`);
      }
      if (error.errno === 1040) {
        throw new Error(`Too many connections to MySQL server: ${error.message}`);
      }
      if (error.code === 'PROTOCOL_SEQUENCE_TIMEOUT') {
        throw new Error(`Query execution timed out. The query might be too complex or the server is overloaded.`);
      }
      if (error.code === 'PROTOCOL_CONNECTION_LOST') {
        throw new Error(`Connection to MySQL server was lost. The server might have been restarted or the network connection interrupted.`);
      }
      
      // Default error with more context
      throw new Error(`MySQL query execution failed: ${error.message}. Error code: ${error.code || error.errno || 'unknown'}`);
    }
  }
  
  /**
   * Close a MySQL connection
   * @param connection MySQL connection to close
   */
  async closeConnection(connection: mysql.Connection): Promise<void> {
    try {
      await connection.end();
      this.logger.log('MySQL connection closed successfully');
    } catch (error) {
      this.logger.error(`Error closing MySQL connection: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Check if a SQL query is safe to execute
   * @param sql SQL query to validate
   * @returns True if the query is safe, false otherwise
   */
  isSafeSqlQuery(sql: string): boolean {
    // Clean the SQL for consistent checking
    const cleanSql = sql.trim().toUpperCase();
    
    // List of dangerous operations to block
    const dangerousPatterns = [
      /\bDROP\s+/,
      /\bDELETE\s+(?!.*\bWHERE\b)/,
      /\bTRUNCATE\s+/,
      /\bALTER\s+/,
      /\bUPDATE\s+(?!.*\bWHERE\b)/,
      /\bGRANT\s+/,
      /\bREVOKE\s+/,
      /\bCREATE\s+USER\b/,
      /\bDROP\s+USER\b/,
      /\bRESET\s+/,
      /\bSHUTDOWN\b/,
      /\bCREATE\s+DATABASE\b/,
      /\bDROP\s+DATABASE\b/
    ];
    
    // Check if query matches any dangerous patterns
    for (const pattern of dangerousPatterns) {
      if (pattern.test(cleanSql)) {
        this.logger.warn(`Unsafe MySQL query detected. Pattern: ${pattern}`);
        return false;
      }
    }
    
    // Additional check for UPDATE statements without WHERE clause
    if (/\bUPDATE\b/.test(cleanSql) && !/\bWHERE\b/.test(cleanSql)) {
      this.logger.warn('Unsafe UPDATE without WHERE clause detected');
      return false;
    }
    
    // Additional check for DELETE statements without WHERE clause
    if (/\bDELETE\b/.test(cleanSql) && !/\bWHERE\b/.test(cleanSql)) {
      this.logger.warn('Unsafe DELETE without WHERE clause detected');
      return false;
    }
    
    return true;
  }
  
  /**
   * Get current database user
   * @param connection MySQL connection
   * @returns Current user name
   */
  async getCurrentUser(connection: mysql.Connection): Promise<string> {
    try {
      // Try different variants of MySQL user-related functions
      // Some MySQL versions use different syntax
      const userQueries = [
        'SELECT USER() AS user',
        'SELECT CURRENT_USER AS user',
        'SELECT SESSION_USER() AS user',
        'SELECT SYSTEM_USER() AS user'
      ];
      
      // Try each query until one works
      for (const query of userQueries) {
        try {
          const [rows] = await connection.query(query);
          
          if (Array.isArray(rows) && rows.length > 0) {
            const row = rows[0] as any;
            const user = row.user || row.USER || row.current_user || row.CURRENT_USER;
            if (user) {
              this.logger.log(`Successfully retrieved MySQL user with query: ${query}`);
              return user;
            }
          }
        } catch (queryError) {
          // If this query fails, try the next one
          this.logger.debug(`Query failed: ${query}, error: ${queryError.message}`);
        }
      }
      
      // If we reach here, none of the queries worked
      return 'UNKNOWN';
    } catch (error) {
      this.logger.error(`Error getting current MySQL user: ${error.message}`);
      return 'UNKNOWN';
    }
  }
  
  /**
   * Get comprehensive database metadata
   * @param connection MySQL connection
   * @returns Database metadata including tables, columns, and relationships
   */
  async getDatabaseMetadata(connection: mysql.Connection): Promise<any> {
    try {
      // Get basic database information
      const dbInfo = await this.getBasicDatabaseInfo(connection);
      
      // Get tables in the database
      const tablesQuery = `
        SELECT 
          table_schema AS \`schema\`,
          table_name,
          table_rows AS row_count
        FROM 
          information_schema.tables
        WHERE 
          table_schema = DATABASE()
          AND table_type = 'BASE TABLE'
        ORDER BY 
          table_name
      `;
      
      const tables = await this.executeQuery(connection, tablesQuery, 10000);
      
      if (tables.length === 0) {
        this.logger.warn('No tables found in database');
        return {
          database: dbInfo,
          tables: [],
          relationships: [],
          tableCount: 0,
          processedTables: 0
        };
      }
      
      // Limit the number of tables to process
      const limitedTables = tables.slice(0, 20);
      this.logger.log(`Found ${tables.length} tables, processing ${limitedTables.length}`);
      
      // Get detailed metadata for tables
      const tableDetails = await this.collectDetailedTableMetadata(connection, limitedTables);
      
      // Get relationships between tables
      const relationships = await this.collectTableRelationships(connection, limitedTables);
      
      return {
        database: dbInfo,
        tables: tableDetails,
        relationships: relationships,
        tableCount: tables.length,
        processedTables: limitedTables.length
      };
    } catch (error) {
      this.logger.error(`Error getting MySQL metadata: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get basic database information
   * @param connection MySQL connection
   * @returns Basic database information
   */
  async getBasicDatabaseInfo(connection: mysql.Connection): Promise<any> {
    try {
      // Get current database name
      const [dbNameResult] = await connection.query('SELECT DATABASE() AS db_name');
      let dbName = 'Unknown';
      
      if (Array.isArray(dbNameResult) && dbNameResult.length > 0) {
        const row = dbNameResult[0] as any;
        dbName = row.db_name || 'Unknown';
      }
      
      // Get MySQL version
      const [versionResult] = await connection.query('SELECT VERSION() AS version');
      let version = 'Unknown';
      
      if (Array.isArray(versionResult) && versionResult.length > 0) {
        const row = versionResult[0] as any;
        version = row.version || 'Unknown';
      }
      
      // Get current user
      const currentUser = await this.getCurrentUser(connection);
      
      return {
        name: dbName,
        version: version,
        currentUser: currentUser,
        type: 'MySQL'
      };
    } catch (error) {
      this.logger.error(`Error getting basic MySQL info: ${error.message}`);
      return {
        name: 'Unknown',
        version: 'Unknown',
        currentUser: 'Unknown',
        type: 'MySQL'
      };
    }
  }
  
  /**
   * Collect detailed metadata for tables
   * @param connection MySQL connection
   * @param tables List of tables to collect metadata for
   * @returns Detailed table metadata
   */
  private async collectDetailedTableMetadata(connection: mysql.Connection, tables: any[]): Promise<any[]> {
    const tableDetails = [];
    
    // Get basic database information for the owner
    const dbInfo = await this.getBasicDatabaseInfo(connection);
    
    for (const table of tables) {
      try {
        // Get columns for this table
        const columnsQuery = `
          SELECT 
            column_name, 
            data_type, 
            character_maximum_length AS data_length,
            numeric_precision AS data_precision, 
            numeric_scale AS data_scale,
            is_nullable
          FROM 
            information_schema.columns
          WHERE 
            table_schema = DATABASE() 
            AND table_name = '${table.table_name}'
          ORDER BY 
            ordinal_position
        `;
        
        const columns = await this.executeQuery(connection, columnsQuery, 5000);
        
        // Format columns to be consistent with Oracle format
        const formattedColumns = columns.map(column => ({
          COLUMN_NAME: column.column_name,
          DATA_TYPE: column.data_type,
          DATA_LENGTH: column.data_length,
          DATA_PRECISION: column.data_precision,
          DATA_SCALE: column.data_scale,
          NULLABLE: column.is_nullable === 'YES' ? 'Y' : 'N'
        }));
        
        // Get primary key columns
        const pkQuery = `
          SELECT 
            column_name
          FROM 
            information_schema.key_column_usage
          WHERE 
            table_schema = DATABASE() 
            AND table_name = '${table.table_name}'
            AND constraint_name = 'PRIMARY'
          ORDER BY 
            ordinal_position
        `;
        
        const pkColumns = await this.executeQuery(connection, pkQuery, 5000);
        const primaryKey = pkColumns.map(row => row.column_name);
        
        // Get sample data (limited to 5 rows)
        const sampleQuery = `
          SELECT * FROM \`${table.table_name}\` LIMIT 5
        `;
        
        const sampleData = await this.executeQuery(connection, sampleQuery, 5000);
        
        // Add table details
        tableDetails.push({
          owner: dbInfo.currentUser,
          schema: table.schema,
          tableName: table.table_name,
          rowCount: table.row_count,
          columns: formattedColumns,
          primaryKey: primaryKey,
          sampleData: sampleData
        });
      } catch (error) {
        this.logger.warn(`Error collecting metadata for table ${table.table_name}: ${error.message}`);
      }
    }
    
    return tableDetails;
  }
  
  /**
   * Collect relationship information between tables
   * @param connection MySQL connection
   * @param tables List of tables to collect relationships for
   * @returns Table relationships
   */
  private async collectTableRelationships(connection: mysql.Connection, tables: any[]): Promise<any[]> {
    const relationships = [];
    
    // Only try to get relationships if we have tables
    if (tables.length === 0) {
      return relationships;
    }
    
    try {
      // Create a comma-separated list of table names in format: 'table_name'
      const tableList = tables.map(t => `'${t.table_name}'`).join(',');
      
      const relationshipsQuery = `
        SELECT
          table_name AS source_table,
          column_name AS source_column,
          referenced_table_name AS target_table,
          referenced_column_name AS target_column
        FROM
          information_schema.key_column_usage
        WHERE
          referenced_table_name IS NOT NULL
          AND table_schema = DATABASE()
          AND referenced_table_schema = DATABASE()
          AND table_name IN (${tableList})
      `;
      
      const relationshipRows = await this.executeQuery(connection, relationshipsQuery, 10000);
      
      // Process relationships
      for (const row of relationshipRows) {
        // Get the database name as schema
        const schema = await this.executeQuery(connection, 'SELECT DATABASE() AS db_name', 1000);
        const dbName = schema.length > 0 ? (schema[0] as any).db_name : 'unknown';
        
        relationships.push({
          type: 'Foreign Key',
          source: {
            schema: dbName, // In MySQL, schema is typically the database name
            table: row.source_table,
            column: row.source_column
          },
          target: {
            schema: dbName,
            table: row.target_table,
            column: row.target_column
          }
        });
      }
    } catch (error) {
      this.logger.warn(`Error collecting MySQL relationships: ${error.message}`);
    }
    
    return relationships;
  }
}