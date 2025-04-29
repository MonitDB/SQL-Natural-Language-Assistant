import { Logger } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { DatabaseProvider } from '../interfaces/database-provider.interface';
import { safelySerializable } from '../../utils/serialize.util';

/**
 * Oracle database provider implementation
 */
export class OracleDatabaseProvider implements DatabaseProvider {
  private readonly logger = new Logger(OracleDatabaseProvider.name);
  
  constructor() {
    // Initialize Oracle client
    this.initOracleClient();
  }
  
  /**
   * Initialize Oracle client
   * This initializes the Oracle client with default values
   */
  private async initOracleClient() {
    try {
      // Set default connection attributes
      oracledb.autoCommit = true;
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      this.logger.log('Oracle client initialized successfully');
    } catch (error) {
      this.logger.error(`Error initializing Oracle client: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Connect to an Oracle database
   * @param config Database connection configuration
   * @returns Oracle database connection
   */
  async connect(config: any): Promise<oracledb.Connection> {
    const { username, password, connectionString, port } = config;
    
    this.logger.log(`Analyzing connection string: ${connectionString}`);
    
    // Check if the connection string is in Easy Connect format
    const isEasyConnect = connectionString.includes(':') && connectionString.includes('/');
    let finalConnectionString = connectionString;
    
    if (isEasyConnect) {
      this.logger.log(`Connection string appears to be in EZ Connect format: ${connectionString}`);
    } else if (port) {
      // Assume it's a hostname and construct easy connect string
      this.logger.log(`Constructing connection string from host and port`);
      const parts = connectionString.split('/');
      const host = parts[0];
      const service = parts.length > 1 ? parts[1] : 'orcl'; // Default to 'orcl' if no service name
      finalConnectionString = `${host}:${port}/${service}`;
    }
    
    this.logger.log(`Final connection string: ${finalConnectionString}`);
    
    // Prepare connection formats to try (in priority order)
    const connectionFormats = [
      // Primary format: EZ Connect with specified format
      {
        name: 'Primary Format',
        config: {
          user: username,
          password: password,
          connectString: finalConnectionString,
          privilege: oracledb.SYSDBA // Try with SYSDBA privilege
        }
      },
      // Alternative format 1: Without privilege
      {
        name: 'Without Privilege',
        config: {
          user: username,
          password: password,
          connectString: finalConnectionString
        }
      },
      // Alternative format 2: Try with TNS format
      {
        name: 'TNS Format',
        config: {
          user: username,
          password: password,
          connectString: finalConnectionString
        }
      },
      // Alternative format 3: With connection attributes
      {
        name: 'With Connection Attributes',
        config: {
          user: username,
          password: password,
          connectString: finalConnectionString,
          connectTimeout: 15,
          stmtCacheSize: 30
        }
      }
    ];
    
    this.logger.log(`Prepared ${connectionFormats.length} connection formats to try`);
    this.logger.log(`Trying connections with 5 second timeout`);
    
    let connection: oracledb.Connection | null = null;
    let error = null;
    
    // Try each connection format until one succeeds
    for (const format of connectionFormats) {
      try {
        this.logger.log(`Attempting format: ${format.name} with timeout: 5s`);
        
        // Create a timeout promise
        const timeoutPromise = new Promise<oracledb.Connection>((_, reject) => {
          setTimeout(() => reject(new Error(`Connection timed out after 5 seconds using ${format.name}`)), 5000);
        });
        
        // Create a connection promise
        const connectionPromise = oracledb.getConnection(format.config);
        
        // Race the two promises
        connection = await Promise.race([connectionPromise, timeoutPromise]);
        
        this.logger.log(`✓ Connection successful using ${format.name}`);
        
        // Test the connection with a simple query
        const testQuery = 'SELECT 1 AS TEST_CONNECTION FROM dual';
        this.logger.log(`Executing SQL query: ${testQuery}`);
        
        const result = await connection.execute(testQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const rows = result.rows || [];
        
        this.logger.log(`Query executed successfully, rows returned: ${rows.length}`);
        this.logger.log(`✓ Connection test query success: ${JSON.stringify(rows)}`);
        
        // Break the loop if we have a successful connection
        break;
      } catch (err) {
        this.logger.warn(`Connection failed using ${format.name}: ${err.message}`);
        error = err;
        
        // Close connection if it was opened but query failed
        if (connection) {
          try {
            await connection.close();
            connection = null;
          } catch (closeError) {
            this.logger.error(`Error closing connection: ${closeError.message}`);
          }
        }
      }
    }
    
    // If we don't have a connection after trying all formats, throw the last error
    if (!connection) {
      const errorMessage = error 
        ? `Failed to connect to Oracle database: ${error.message}`
        : 'Failed to connect to Oracle database: Unknown error';
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    return connection;
  }
  
  /**
   * Execute a SQL query on a given connection with timeout
   */
  async executeQuery(
    connection: oracledb.Connection, 
    sql: string, 
    timeout: number = 10000
  ): Promise<any[]> {
    // Clean the SQL query
    sql = sql.trim();
    
    // If query has trailing semicolon, remove it (Oracle doesn't like them)
    if (sql.endsWith(';')) {
      sql = sql.slice(0, -1);
    }
    
    this.logger.log(`Executing SQL query: ${sql}`);
    
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<any>((_, reject) => {
        setTimeout(() => reject(new Error(`Query timed out after ${timeout}ms`)), timeout);
      });
      
      // Create a query execution promise
      const queryPromise = connection.execute(sql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      
      // Race the two promises
      const result = await Promise.race([queryPromise, timeoutPromise]);
      
      const rows = result.rows || [];
      let message = `Query executed successfully, rows returned: ${rows.length}`;
      
      // Check if results were limited (for safety)
      if (sql.toUpperCase().includes('ROWNUM <=') || sql.toUpperCase().includes('FETCH FIRST')) {
        const limitMatch = sql.match(/ROWNUM\s*<=\s*(\d+)/i) || sql.match(/FETCH\s+FIRST\s+(\d+)/i);
        if (limitMatch && rows.length == parseInt(limitMatch[1])) {
          message += `\nResults were limited to ${limitMatch[1]} rows`;
        }
      }
      
      this.logger.log(message);
      return rows;
    } catch (error) {
      this.logger.error(`Error executing query: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Close an Oracle database connection
   */
  async closeConnection(connection: oracledb.Connection): Promise<void> {
    try {
      await connection.close();
      this.logger.log('Oracle database connection closed successfully');
    } catch (error) {
      this.logger.error(`Error closing Oracle connection: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Check if a SQL query is safe to execute
   * Prevents destructive operations like DROP, DELETE, UPDATE without WHERE, etc.
   */
  isSafeSqlQuery(sql: string): boolean {
    // Clean the SQL for consistent checking
    const cleanSql = sql.trim().toUpperCase();
    
    // Dangerous operations to block
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
      /\bSHUTDOWN\b/,
      /\bRESTART\b/,
      /\bINIT\b/,
      /\bEXECUTE\s+IMMEDIATE\b/,
      /\bEXEC\s+/,
      /\bCREATE\s+DATABASE\b/,
      /\bDROP\s+DATABASE\b/
    ];
    
    // Check if the SQL matches any dangerous patterns
    for (const pattern of dangerousPatterns) {
      if (pattern.test(cleanSql)) {
        this.logger.warn(`Unsafe SQL query detected. Pattern: ${pattern}`);
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
    
    // If we have INSERT with more than 5 rows, consider it potentially unsafe
    if (/\bINSERT\b/.test(cleanSql) && (cleanSql.match(/VALUES/g) || []).length > 5) {
      this.logger.warn('Potentially unsafe INSERT with many values detected');
      return false;
    }
    
    return true;
  }
  
  /**
   * Get comprehensive database metadata including tables, columns, constraints and sample data
   */
  async getDatabaseMetadata(connection: oracledb.Connection): Promise<any> {
    try {
      // Get current user to focus on their objects first
      const currentUser = await this.getCurrentUser(connection);
      
      // Get basic database information
      const dbInfo = await this.getBasicDatabaseInfo(connection);
      
      // Get all tables accessible to the user
      const tablesQuery = `
        SELECT owner, table_name, num_rows 
        FROM all_tables 
        WHERE owner = '${currentUser}' OR owner IN ('HR', 'SCOTT', 'SH', 'OE')
        ORDER BY owner, table_name
      `;
      
      const tables = await this.executeQuery(connection, tablesQuery, 10000);
      
      if (tables.length === 0) {
        this.logger.warn('No tables found for user or common schemas');
        
        // Try to get dictionary views instead when no regular tables are available
        return this.getDictionaryViewsMetadata(connection);
      }
      
      // Limit the number of tables to process to avoid overwhelming the API
      const limitedTables = tables.slice(0, 20);
      this.logger.log(`Found ${tables.length} tables, processing ${limitedTables.length}`);
      
      // Get detailed metadata for selected tables
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
      this.logger.error(`Error getting database metadata: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get basic database information
   */
  async getBasicDatabaseInfo(connection: oracledb.Connection): Promise<any> {
    try {
      const currentUser = await this.getCurrentUser(connection);
      
      // Get database product version
      const versionQuery = "SELECT banner FROM v$version WHERE banner LIKE 'Oracle%'";
      let version = 'Unknown';
      
      try {
        const versionResult = await this.executeQuery(connection, versionQuery, 5000);
        if (versionResult.length > 0) {
          version = versionResult[0].BANNER;
        }
      } catch (e) {
        this.logger.warn(`Could not retrieve version: ${e.message}`);
      }
      
      // Get database name
      const dbNameQuery = "SELECT SYS_CONTEXT('USERENV', 'DB_NAME') AS DB_NAME FROM dual";
      let dbName = 'Unknown';
      
      try {
        const dbNameResult = await this.executeQuery(connection, dbNameQuery, 5000);
        if (dbNameResult.length > 0) {
          dbName = dbNameResult[0].DB_NAME;
        }
      } catch (e) {
        this.logger.warn(`Could not retrieve database name: ${e.message}`);
      }
      
      return {
        name: dbName,
        version: version,
        currentUser: currentUser,
        type: 'Oracle'
      };
    } catch (error) {
      this.logger.error(`Error getting basic database info: ${error.message}`);
      return {
        name: 'Unknown',
        version: 'Unknown',
        currentUser: 'Unknown',
        type: 'Oracle'
      };
    }
  }
  
  /**
   * Get the current database user
   */
  async getCurrentUser(connection: oracledb.Connection): Promise<string> {
    try {
      const userQuery = "SELECT SYS_CONTEXT('USERENV', 'SESSION_USER') AS CURRENT_USER FROM dual";
      const result = await this.executeQuery(connection, userQuery, 5000);
      
      if (result.length > 0) {
        return result[0].CURRENT_USER;
      }
      
      return 'UNKNOWN';
    } catch (error) {
      this.logger.error(`Error getting current user: ${error.message}`);
      return 'UNKNOWN';
    }
  }
  
  /**
   * Get dictionary views metadata when no regular tables are accessible
   */
  private async getDictionaryViewsMetadata(connection: oracledb.Connection): Promise<any> {
    try {
      const dbInfo = await this.getBasicDatabaseInfo(connection);
      
      // Query to get dictionary views
      const viewsQuery = `
        SELECT view_name, text 
        FROM all_views 
        WHERE owner = 'SYS' AND view_name LIKE 'DBA_%'
        ORDER BY view_name
      `;
      
      let views = [];
      try {
        views = await this.executeQuery(connection, viewsQuery, 10000);
      } catch (error) {
        this.logger.warn(`Could not query dictionary views: ${error.message}`);
      }
      
      return {
        database: dbInfo,
        tables: [],
        views: views.slice(0, 20), // Limit to 20 views
        dictionary: true,
        relationships: [],
        tableCount: 0,
        processedTables: 0
      };
    } catch (error) {
      this.logger.error(`Error getting dictionary views metadata: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Collect detailed metadata for a list of tables
   */
  private async collectDetailedTableMetadata(connection: oracledb.Connection, tables: any[]): Promise<any[]> {
    const tableDetails = [];
    
    for (const table of tables) {
      try {
        // Get columns for this table
        const columnsQuery = `
          SELECT column_name, data_type, data_length, data_precision, data_scale, nullable
          FROM all_tab_columns
          WHERE owner = '${table.OWNER}' AND table_name = '${table.TABLE_NAME}'
          ORDER BY column_id
        `;
        
        const columns = await this.executeQuery(connection, columnsQuery, 5000);
        
        // Get primary key columns
        const pkQuery = `
          SELECT cols.column_name
          FROM all_constraints cons, all_cons_columns cols
          WHERE cons.constraint_type = 'P'
          AND cons.owner = '${table.OWNER}'
          AND cons.table_name = '${table.TABLE_NAME}'
          AND cons.constraint_name = cols.constraint_name
          AND cons.owner = cols.owner
          ORDER BY cols.position
        `;
        
        const pkColumns = await this.executeQuery(connection, pkQuery, 5000);
        const primaryKey = pkColumns.map(row => row.COLUMN_NAME);
        
        // Get sample data (limited to 5 rows)
        const sampleQuery = `SELECT * FROM ${table.OWNER}.${table.TABLE_NAME} WHERE ROWNUM <= 5`;
        const sampleData = await this.executeQuery(connection, sampleQuery, 5000);
        
        // Add table details
        tableDetails.push({
          owner: table.OWNER,
          tableName: table.TABLE_NAME,
          rowCount: table.NUM_ROWS,
          columns: columns,
          primaryKey: primaryKey,
          sampleData: sampleData
        });
      } catch (error) {
        this.logger.warn(`Error collecting metadata for table ${table.OWNER}.${table.TABLE_NAME}: ${error.message}`);
      }
    }
    
    return tableDetails;
  }
  
  /**
   * Collect relationship information between tables
   */
  private async collectTableRelationships(connection: oracledb.Connection, tables: any[]): Promise<any[]> {
    const relationships = [];
    
    // Only try to get relationships if we have tables
    if (tables.length === 0) {
      return relationships;
    }
    
    try {
      // Prepare list of tables for the query
      const tableOwners = tables.map(t => `'${t.OWNER}'`).join(',');
      const tableNames = tables.map(t => `'${t.TABLE_NAME}'`).join(',');
      
      const relationshipsQuery = `
        SELECT
          cons.owner as source_owner,
          cons.table_name as source_table,
          cols.column_name as source_column,
          r_cons.owner as target_owner,
          r_cons.table_name as target_table,
          r_cols.column_name as target_column
        FROM
          all_constraints cons
          JOIN all_cons_columns cols ON cons.constraint_name = cols.constraint_name AND cons.owner = cols.owner
          JOIN all_constraints r_cons ON cons.r_constraint_name = r_cons.constraint_name AND cons.r_owner = r_cons.owner
          JOIN all_cons_columns r_cols ON r_cons.constraint_name = r_cols.constraint_name AND r_cons.owner = r_cols.owner
        WHERE
          cons.constraint_type = 'R'
          AND cons.owner IN (${tableOwners})
          AND cons.table_name IN (${tableNames})
      `;
      
      const relationshipRows = await this.executeQuery(connection, relationshipsQuery, 10000);
      
      // Process relationships
      for (const row of relationshipRows) {
        relationships.push({
          type: 'Foreign Key',
          source: {
            schema: row.SOURCE_OWNER,
            table: row.SOURCE_TABLE,
            column: row.SOURCE_COLUMN
          },
          target: {
            schema: row.TARGET_OWNER,
            table: row.TARGET_TABLE,
            column: row.TARGET_COLUMN
          }
        });
      }
    } catch (error) {
      this.logger.warn(`Error collecting relationships: ${error.message}`);
    }
    
    return relationships;
  }
}