import { Logger } from '@nestjs/common';
import * as mssql from 'mssql';
import { DatabaseProvider } from '../interfaces/database-provider.interface';

/**
 * Microsoft SQL Server database provider implementation
 */
export class MssqlDatabaseProvider implements DatabaseProvider {
  private readonly logger = new Logger(MssqlDatabaseProvider.name);
  
  /**
   * Connect to a Microsoft SQL Server database
   * @param config Database connection configuration
   * @returns SQL Server connection pool
   */
  async connect(config: any): Promise<mssql.ConnectionPool> {
    const { username, password, host, port, database } = config;
    
    this.logger.log(`Connecting to SQL Server database: ${host}:${port}/${database}`);
    
    try {
      // Create connection config
      const connectionConfig: mssql.config = {
        user: username,
        password: password,
        server: host,
        port: port,
        database: database,
        options: {
          trustServerCertificate: true, // For dev environment
          encrypt: true, // Use encryption
          // Add timeout options
          connectTimeout: 5000,
          requestTimeout: 30000
        }
      };
      
      // Create connection pool
      const pool = new mssql.ConnectionPool(connectionConfig);
      await pool.connect();
      
      // Test the connection
      this.logger.log('Testing connection with a simple query...');
      await pool.request().query('SELECT 1 AS connection_test');
      this.logger.log('✓ SQL Server connection successful');
      
      return pool;
    } catch (error) {
      this.logger.error(`Error connecting to SQL Server: ${error.message}`);
      
      // Enhanced error handling with specific diagnostic information
      // MSSQL error codes: https://learn.microsoft.com/en-us/sql/relational-databases/errors-events/database-engine-error-severities
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Could not connect to SQL Server at ${host}:${port}. Make sure the server is running and accessible.`);
      }
      if (error.code === 'ETIMEDOUT') {
        throw new Error(`Connection to SQL Server at ${host}:${port} timed out. Check network connectivity and firewall settings.`);
      }
      if (error.code === 'ENOTFOUND') {
        throw new Error(`Host "${host}" not found. Check the hostname and DNS resolution.`);
      }
      if (error.code === 'ESOCKET') {
        throw new Error(`Socket error connecting to SQL Server. This could be due to network issues or incorrect port configuration.`);
      }
      
      // MSSQL specific error codes
      if (error.number === 4060) {
        throw new Error(`Cannot open database "${database}". The database might not exist or you don't have access to it.`);
      }
      if (error.number === 18456) {
        throw new Error(`Login failed for user "${username}". Check your username and password.`);
      }
      if (error.number === 233) {
        throw new Error(`SQL Server connection failed. The server was not found or was not accessible.`);
      }
      if (error.number === 53) {
        throw new Error(`SQL Server connection error: Unable to connect due to network or instance-specific error.`);
      }
      if (error.number === 2) {
        throw new Error(`SQL Server connection error: Server is not found or not accessible.`);
      }
      if (error.number === 40615) {
        throw new Error(`Cannot connect to SQL Server. The connection attempt was refused or timed out.`);
      }
      if (error.number === 40532) {
        throw new Error(`The server is busy processing multiple connections. Try again later.`);
      }
      
      // Timeout specific errors
      if (error.code === 'ETIMEOUT') {
        throw new Error(`Connection timeout exceeded. The SQL Server didn't respond within the timeout period.`);
      }
      
      // Default error message with more context
      throw new Error(`Failed to connect to SQL Server database: ${error.message}. Error code: ${error.code || error.number || 'unknown'}`);
    }
  }
  
  /**
   * Execute a SQL query on SQL Server connection
   * @param connection SQL Server connection pool
   * @param sql SQL query to execute
   * @param timeout Query timeout in milliseconds
   * @returns Query results as array of objects
   */
  async executeQuery(
    connection: mssql.ConnectionPool, 
    sql: string, 
    timeout: number = 10000
  ): Promise<any[]> {
    const cleanSql = sql.trim();
    this.logger.log(`Executing SQL Server query: ${cleanSql}`);
    
    try {
      // Create a request with our own timeout handling
      const request = connection.request();
      
      // Using a promise race to implement timeout
      const queryPromise = request.query(cleanSql);
      const timeoutPromise = new Promise<any>((_, reject) => {
        setTimeout(() => reject(new Error('Query execution timed out')), timeout);
      });
      
      // Execute the query with timeout
      const result = await Promise.race([queryPromise, timeoutPromise]);
      this.logger.log(`Query executed successfully, rows returned: ${result.recordset?.length || 0}`);
      
      return result.recordset || [];
    } catch (error) {
      this.logger.error(`Error executing SQL Server query: ${error.message}`);
      
      // Enhanced error handling for SQL Server query execution
      // Error numbers: https://learn.microsoft.com/en-us/sql/relational-databases/errors-events/database-engine-events-and-errors
      
      // Timeout errors
      if (error.code === 'ETIMEOUT') {
        throw new Error(`Query execution timed out. The query took longer than ${timeout}ms to execute.`);
      }
      
      // SQL Server specific error codes
      if (error.number === 208) {
        throw new Error(`Invalid object name. The specified table or view does not exist.`);
      }
      if (error.number === 207) {
        throw new Error(`Invalid column name. One or more columns in the query do not exist.`);
      }
      if (error.number === 156 || error.number === 170) {
        throw new Error(`SQL syntax error. Check the query syntax: ${error.message}`);
      }
      if (error.number === 1205) {
        throw new Error(`Transaction deadlock. Try simplifying the transaction or retry later.`);
      }
      if (error.number === 229) {
        throw new Error(`Permission denied. The current user lacks SELECT permission on the object.`);
      }
      if (error.number === 4060) {
        throw new Error(`Cannot open database. The database might not exist or you don't have access to it.`);
      }
      if (error.number === 4064) {
        throw new Error(`Database is not available. The database may be offline or inaccessible.`);
      }
      if (error.number === 547) {
        throw new Error(`Constraint violation. The statement conflicted with a database constraint.`);
      }
      if (error.number === 262) {
        throw new Error(`Table/view does not have a primary key defined and cannot be referenced.`);
      }
      if (error.number === 8152) {
        throw new Error(`String or binary data would be truncated. The data is too long for a column.`);
      }
      
      // Connection state errors
      if (!connection.connected) {
        throw new Error(`Connection closed or broken. The SQL Server connection is no longer active.`);
      }
      
      // Default error with more context
      throw new Error(`SQL Server query execution failed: ${error.message}. Error code: ${error.code || error.number || 'unknown'}`);
    }
  }
  
  /**
   * Close a SQL Server connection
   * @param connection SQL Server connection pool to close
   */
  async closeConnection(connection: mssql.ConnectionPool): Promise<void> {
    try {
      await connection.close();
      this.logger.log('SQL Server connection closed successfully');
    } catch (error) {
      this.logger.error(`Error closing SQL Server connection: ${error.message}`);
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
      /\bCREATE\s+LOGIN\b/,
      /\bDROP\s+LOGIN\b/,
      /\bCREATE\s+USER\b/,
      /\bDROP\s+USER\b/,
      /\bEXEC\s+/,
      /\bEXECUTE\s+/,
      /\bSP_\w+/,
      /\bXP_\w+/,
      /\bCREATE\s+DATABASE\b/,
      /\bDROP\s+DATABASE\b/
    ];
    
    // Check if query matches any dangerous patterns
    for (const pattern of dangerousPatterns) {
      if (pattern.test(cleanSql)) {
        this.logger.warn(`Unsafe SQL Server query detected. Pattern: ${pattern}`);
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
   * @param connection SQL Server connection pool
   * @returns Current user name
   */
  async getCurrentUser(connection: mssql.ConnectionPool): Promise<string> {
    try {
      // In SQL Server, use USER_NAME() function instead of CURRENT_USER
      const result = await this.executeQuery(connection, 'SELECT USER_NAME() AS current_user', 5000);
      return result.length > 0 ? result[0].current_user : 'UNKNOWN';
    } catch (error) {
      this.logger.error(`Error getting current SQL Server user: ${error.message}`);
      return 'UNKNOWN';
    }
  }
  
  /**
   * Get comprehensive database metadata
   * @param connection SQL Server connection pool
   * @returns Database metadata including tables, columns, and relationships
   */
  async getDatabaseMetadata(connection: mssql.ConnectionPool): Promise<any> {
    try {
      // Get basic database information
      const dbInfo = await this.getBasicDatabaseInfo(connection);
      
      // Get tables in the database
      const tablesQuery = `
        SELECT 
          s.name AS 'schema',
          t.name AS table_name,
          p.rows AS row_count
        FROM 
          sys.tables t
          INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
          INNER JOIN sys.indexes i ON t.object_id = i.object_id
          INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
        WHERE 
          i.index_id <= 1
        GROUP BY 
          s.name, t.name, p.rows
        ORDER BY 
          s.name, t.name
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
      this.logger.error(`Error getting SQL Server metadata: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get basic database information
   * @param connection SQL Server connection pool
   * @returns Basic database information
   */
  async getBasicDatabaseInfo(connection: mssql.ConnectionPool): Promise<any> {
    try {
      // Get current database name
      const dbNameResult = await this.executeQuery(connection, 'SELECT DB_NAME() AS db_name', 5000);
      const dbName = dbNameResult.length > 0 ? dbNameResult[0].db_name : 'Unknown';
      
      // Get SQL Server version
      const versionResult = await this.executeQuery(connection, 'SELECT @@VERSION AS version', 5000);
      const version = versionResult.length > 0 ? versionResult[0].version : 'Unknown';
      
      // Get current user
      const currentUser = await this.getCurrentUser(connection);
      
      return {
        name: dbName,
        version: version,
        currentUser: currentUser,
        type: 'SQL Server'
      };
    } catch (error) {
      this.logger.error(`Error getting basic SQL Server info: ${error.message}`);
      return {
        name: 'Unknown',
        version: 'Unknown',
        currentUser: 'Unknown',
        type: 'SQL Server'
      };
    }
  }
  
  /**
   * Collect detailed metadata for tables
   * @param connection SQL Server connection pool
   * @param tables List of tables to collect metadata for
   * @returns Detailed table metadata
   */
  private async collectDetailedTableMetadata(connection: mssql.ConnectionPool, tables: any[]): Promise<any[]> {
    const tableDetails = [];
    
    for (const table of tables) {
      try {
        // Get columns for this table
        const columnsQuery = `
          SELECT 
            c.name AS column_name, 
            t.name AS data_type,
            c.max_length AS data_length,
            c.precision AS data_precision,
            c.scale AS data_scale,
            c.is_nullable
          FROM 
            sys.columns c
            INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
            INNER JOIN sys.tables tbl ON c.object_id = tbl.object_id
            INNER JOIN sys.schemas s ON tbl.schema_id = s.schema_id
          WHERE 
            s.name = '${table.schema}' 
            AND tbl.name = '${table.table_name}'
          ORDER BY 
            c.column_id
        `;
        
        const columns = await this.executeQuery(connection, columnsQuery, 5000);
        
        // Format columns to be consistent with Oracle format
        const formattedColumns = columns.map(column => ({
          COLUMN_NAME: column.column_name,
          DATA_TYPE: column.data_type,
          DATA_LENGTH: column.data_length,
          DATA_PRECISION: column.data_precision,
          DATA_SCALE: column.data_scale,
          NULLABLE: column.is_nullable ? 'Y' : 'N'
        }));
        
        // Get primary key columns
        const pkQuery = `
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
            AND s.name = '${table.schema}'
            AND t.name = '${table.table_name}'
          ORDER BY 
            ic.key_ordinal
        `;
        
        const pkColumns = await this.executeQuery(connection, pkQuery, 5000);
        const primaryKey = pkColumns.map(row => row.column_name);
        
        // Get sample data (limited to 5 rows)
        const sampleQuery = `
          SELECT TOP 5 * FROM [${table.schema}].[${table.table_name}]
        `;
        
        const sampleData = await this.executeQuery(connection, sampleQuery, 5000);
        
        // Add table details
        tableDetails.push({
          owner: table.schema,
          schema: table.schema,
          tableName: table.table_name,
          rowCount: table.row_count,
          columns: formattedColumns,
          primaryKey: primaryKey,
          sampleData: sampleData
        });
      } catch (error) {
        this.logger.warn(`Error collecting metadata for table ${table.schema}.${table.table_name}: ${error.message}`);
      }
    }
    
    return tableDetails;
  }
  
  /**
   * Collect relationship information between tables
   * @param connection SQL Server connection pool
   * @param tables List of tables to collect relationships for
   * @returns Table relationships
   */
  private async collectTableRelationships(connection: mssql.ConnectionPool, tables: any[]): Promise<any[]> {
    const relationships = [];
    
    // Only try to get relationships if we have tables
    if (tables.length === 0) {
      return relationships;
    }
    
    try {
      // Create a list of schema.table_name values
      const tableList = tables.map(t => `'${t.schema}.${t.table_name}'`).join(',');
      
      const relationshipsQuery = `
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
          ss.name + '.' + st.name IN (${tableList})
        ORDER BY
          ss.name, st.name, sc.name
      `;
      
      // SQL Server may have issues with the query above, provide a fallback
      let relationshipRows;
      try {
        relationshipRows = await this.executeQuery(connection, relationshipsQuery, 10000);
      } catch (error) {
        this.logger.warn(`Error executing relationship query: ${error.message}. Trying fallback.`);
        
        // Fallback to a simpler relationship query
        const fallbackQuery = `
          SELECT
            OBJECT_SCHEMA_NAME(f.parent_object_id) AS source_schema,
            OBJECT_NAME(f.parent_object_id) AS source_table,
            COL_NAME(fc.parent_object_id, fc.parent_column_id) AS source_column,
            OBJECT_SCHEMA_NAME(f.referenced_object_id) AS target_schema,
            OBJECT_NAME(f.referenced_object_id) AS target_table,
            COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS target_column
          FROM 
            sys.foreign_keys AS f
            INNER JOIN sys.foreign_key_columns AS fc ON f.object_id = fc.constraint_object_id
          ORDER BY
            source_schema, source_table
        `;
        
        relationshipRows = await this.executeQuery(connection, fallbackQuery, 10000);
      }
      
      // Process relationships
      for (const row of relationshipRows) {
        relationships.push({
          type: 'Foreign Key',
          source: {
            schema: row.source_schema,
            table: row.source_table,
            column: row.source_column
          },
          target: {
            schema: row.target_schema,
            table: row.target_table,
            column: row.target_column
          }
        });
      }
    } catch (error) {
      this.logger.warn(`Error collecting SQL Server relationships: ${error.message}`);
    }
    
    return relationships;
  }
}