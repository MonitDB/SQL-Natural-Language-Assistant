import { Logger } from '@nestjs/common';
import { Pool, Client, QueryResult } from 'pg';
import { DatabaseProvider } from '../interfaces/database-provider.interface';

// Don't use Oracle-specific views that don't exist in PostgreSQL
// Use PostgreSQL system catalogs instead:
// - Use pg_tables instead of all_tables/user_tables
// - Use information_schema.tables instead of all_tables
// - Use information_schema.columns instead of all_tab_columns

/**
 * PostgreSQL database provider implementation
 */
export class PostgresDatabaseProvider implements DatabaseProvider {
  private readonly logger = new Logger(PostgresDatabaseProvider.name);
  
  /**
   * Connect to a PostgreSQL database
   * @param config Database connection configuration
   * @returns PostgreSQL client connection
   */
  async connect(config: any): Promise<Client> {
    const { username, password, host, port, database } = config;
    
    this.logger.log(`Connecting to PostgreSQL database: ${host}:${port}/${database}`);
    
    try {
      // Create connection config
      const connectionConfig = {
        user: username,
        password: password,
        host: host,
        port: port,
        database: database,
        // Add SSL support if needed
        ssl: config.ssl ? {
          rejectUnauthorized: false // For self-signed certificates
        } : undefined
      };
      
      // Create client
      const client = new Client(connectionConfig);
      
      // Connect with timeout
      const timeoutPromise = new Promise<Client>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timed out after 5 seconds')), 5000);
      });
      
      const connectionPromise = (async () => {
        await client.connect();
        return client;
      })();
      
      const connectedClient = await Promise.race([connectionPromise, timeoutPromise]);
      
      // Test the connection
      this.logger.log('Testing connection with a simple query...');
      await client.query('SELECT 1 AS connection_test');
      this.logger.log('✓ PostgreSQL connection successful');
      
      return connectedClient;
    } catch (error) {
      this.logger.error(`Error connecting to PostgreSQL: ${error.message}`);
      
      // Enhanced error handling with specific diagnostic information
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Could not connect to PostgreSQL server at ${host}:${port}. Make sure the server is running and accessible.`);
      }
      if (error.code === 'ETIMEDOUT') {
        throw new Error(`Connection to PostgreSQL server at ${host}:${port} timed out. Check network connectivity and firewall settings.`);
      }
      if (error.code === '28P01') {
        throw new Error(`Authentication failed for user "${username}". Check your username and password.`);
      }
      if (error.code === '3D000') {
        throw new Error(`Database "${database}" does not exist on the PostgreSQL server.`);
      }
      if (error.code === '28000') {
        throw new Error(`User "${username}" does not have permission to access the database.`);
      }
      if (error.code === '42P01') {
        throw new Error(`Relation not found. The specified table or view does not exist.`);
      }
      if (error.code === 'ENOTFOUND') {
        throw new Error(`Host "${host}" not found. Check the hostname and DNS resolution.`);
      }
      if (error.code === '08006') {
        throw new Error(`Connection terminated unexpectedly. The server may have been shut down or restarted.`);
      }
      
      // Default error
      throw new Error(`Failed to connect to PostgreSQL database: ${error.message}. Error code: ${error.code || 'unknown'}`);
    }
  }
  
  /**
   * Execute a SQL query on PostgreSQL connection
   * @param connection PostgreSQL client connection
   * @param sql SQL query to execute
   * @param timeout Query timeout in milliseconds
   * @returns Query results as array of objects
   */
  async executeQuery(
    connection: Client, 
    sql: string, 
    timeout: number = 10000
  ): Promise<any[]> {
    const cleanSql = sql.trim();
    this.logger.log(`Executing PostgreSQL query: ${cleanSql}`);
    
    try {
      // Set statement timeout in PostgreSQL
      await connection.query(`SET statement_timeout TO ${Math.floor(timeout)}`);
      
      const result: QueryResult = await connection.query(cleanSql);
      this.logger.log(`Query executed successfully, rows returned: ${result.rowCount || 0}`);
      
      return result.rows || [];
    } catch (error) {
      this.logger.error(`Error executing PostgreSQL query: ${error.message}`);
      
      // Enhanced error handling for query execution
      if (error.code === '42P01') {
        throw new Error(`Table or view does not exist: ${error.message}`);
      }
      if (error.code === '42703') {
        throw new Error(`Column does not exist: ${error.message}`);
      }
      if (error.code === '42P18' || error.code === '42809') {
        throw new Error(`Invalid function or procedure: ${error.message}`);
      }
      if (error.code === '23502') {
        throw new Error(`Not null violation: ${error.message}`);
      }
      if (error.code === '23505') {
        throw new Error(`Unique violation: ${error.message}`);
      }
      if (error.code === '42601') {
        throw new Error(`Syntax error in SQL statement: ${error.message}`);
      }
      if (error.code === '42501') {
        throw new Error(`Insufficient privileges: ${error.message}`);
      }
      if (error.code === '53300') {
        throw new Error(`Query timeout: The query took too long to execute and was canceled.`);
      }
      if (error.code === '53400') {
        throw new Error(`Configuration limit exceeded: ${error.message}`);
      }
      if (error.code === '08006') {
        throw new Error(`Connection terminated unexpectedly. The server may have been shut down or restarted.`);
      }
      
      // Default error with code
      throw new Error(`PostgreSQL query execution failed: ${error.message}. Error code: ${error.code || 'unknown'}`);
    }
  }
  
  /**
   * Close a PostgreSQL connection
   * @param connection PostgreSQL client to close
   */
  async closeConnection(connection: Client): Promise<void> {
    try {
      await connection.end();
      this.logger.log('PostgreSQL connection closed successfully');
    } catch (error) {
      this.logger.error(`Error closing PostgreSQL connection: ${error.message}`);
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
      /\bCREATE\s+DATABASE\b/,
      /\bDROP\s+DATABASE\b/
    ];
    
    // Check if query matches any dangerous patterns
    for (const pattern of dangerousPatterns) {
      if (pattern.test(cleanSql)) {
        this.logger.warn(`Unsafe PostgreSQL query detected. Pattern: ${pattern}`);
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
   * @param connection PostgreSQL client connection
   * @returns Current user name
   */
  async getCurrentUser(connection: Client): Promise<string> {
    try {
      const result = await this.executeQuery(connection, 'SELECT current_user', 5000);
      return result[0]?.current_user || 'UNKNOWN';
    } catch (error) {
      this.logger.error(`Error getting current PostgreSQL user: ${error.message}`);
      return 'UNKNOWN';
    }
  }
  
  /**
   * Get comprehensive database metadata
   * @param connection PostgreSQL client connection
   * @returns Database metadata including tables, columns, and relationships
   */
  async getDatabaseMetadata(connection: Client): Promise<any> {
    try {
      // Get current user to focus on their objects first
      const currentUser = await this.getCurrentUser(connection);
      
      // Get basic database information
      const dbInfo = await this.getBasicDatabaseInfo(connection);
      
      // Get tables in the database
      const tablesQuery = `
        SELECT 
          schemaname AS schema,
          tablename AS table_name,
          tableowner AS owner
        FROM 
          pg_catalog.pg_tables
        WHERE 
          schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY 
          schemaname, tablename
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
      this.logger.error(`Error getting PostgreSQL metadata: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get basic database information
   * @param connection PostgreSQL client connection
   * @returns Basic database information
   */
  async getBasicDatabaseInfo(connection: Client): Promise<any> {
    try {
      // Get current database name
      const dbNameQuery = 'SELECT current_database() AS db_name';
      const dbNameResult = await this.executeQuery(connection, dbNameQuery, 5000);
      const dbName = dbNameResult[0]?.db_name || 'Unknown';
      
      // Get PostgreSQL version
      const versionQuery = 'SELECT version()';
      const versionResult = await this.executeQuery(connection, versionQuery, 5000);
      const version = versionResult[0]?.version || 'Unknown';
      
      // Get current user
      const currentUser = await this.getCurrentUser(connection);
      
      return {
        name: dbName,
        version: version,
        currentUser: currentUser,
        type: 'PostgreSQL'
      };
    } catch (error) {
      this.logger.error(`Error getting basic PostgreSQL info: ${error.message}`);
      return {
        name: 'Unknown',
        version: 'Unknown',
        currentUser: 'Unknown',
        type: 'PostgreSQL'
      };
    }
  }
  
  /**
   * Collect detailed metadata for tables
   * @param connection PostgreSQL client connection
   * @param tables List of tables to collect metadata for
   * @returns Detailed table metadata
   */
  private async collectDetailedTableMetadata(connection: Client, tables: any[]): Promise<any[]> {
    const tableDetails = [];
    
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
            table_schema = '${table.schema}' 
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
            kcu.column_name
          FROM 
            information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
              ON tc.constraint_name = kcu.constraint_name 
              AND tc.table_schema = kcu.table_schema
          WHERE 
            tc.constraint_type = 'PRIMARY KEY' 
            AND tc.table_schema = '${table.schema}' 
            AND tc.table_name = '${table.table_name}'
          ORDER BY 
            kcu.ordinal_position
        `;
        
        const pkColumns = await this.executeQuery(connection, pkQuery, 5000);
        const primaryKey = pkColumns.map(row => row.column_name);
        
        // Get sample data (limited to 5 rows)
        const sampleQuery = `
          SELECT * FROM "${table.schema}"."${table.table_name}" LIMIT 5
        `;
        
        const sampleData = await this.executeQuery(connection, sampleQuery, 5000);
        
        // Get approximate row count (faster than COUNT(*))
        const rowCountQuery = `
          SELECT 
            n_live_tup AS row_count
          FROM 
            pg_stat_user_tables
          WHERE 
            schemaname = '${table.schema}' 
            AND relname = '${table.table_name}'
        `;
        
        const rowCountResult = await this.executeQuery(connection, rowCountQuery, 5000);
        const rowCount = rowCountResult[0]?.row_count || 0;
        
        // Add table details
        tableDetails.push({
          owner: table.owner,
          schema: table.schema,
          tableName: table.table_name,
          rowCount: rowCount,
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
   * @param connection PostgreSQL client connection
   * @param tables List of tables to collect relationships for
   * @returns Table relationships
   */
  private async collectTableRelationships(connection: Client, tables: any[]): Promise<any[]> {
    const relationships = [];
    
    // Only try to get relationships if we have tables
    if (tables.length === 0) {
      return relationships;
    }
    
    try {
      // Create a comma-separated list of schema.table_name values in format: 'schema.table_name'
      const tableList = tables.map(t => `'${t.schema}.${t.table_name}'`).join(',');
      
      const relationshipsQuery = `
        SELECT
          tc.table_schema AS source_schema,
          tc.table_name AS source_table,
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
          AND CONCAT(tc.table_schema, '.', tc.table_name) IN (${tableList})
      `;
      
      const relationshipRows = await this.executeQuery(connection, relationshipsQuery, 10000);
      
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
      this.logger.warn(`Error collecting PostgreSQL relationships: ${error.message}`);
    }
    
    return relationships;
  }
}