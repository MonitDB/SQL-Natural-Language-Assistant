import { Injectable, Logger } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { DatabaseFactoryService, DatabaseType } from './database-factory.service';
import { DatabaseProvider } from './interfaces/database-provider.interface';

/**
 * Enhanced database service with support for multiple database types
 */
@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private activeConnections: Map<string, any> = new Map();
  private activeProviders: Map<string, DatabaseProvider> = new Map();

  constructor(private readonly databaseFactoryService: DatabaseFactoryService) {
    this.logger.log('Database service initialized');
    
    // Initialize Oracle client for backward compatibility
    try {
      oracledb.autoCommit = true;
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    } catch (error) {
      this.logger.warn(`Oracle client initialization skipped: ${error.message}`);
    }
  }

  /**
   * Multi-database connect method
   * Supports Oracle, PostgreSQL, MySQL, and MS SQL Server
   */
  async connect(
    username: string,
    password: string,
    connectionString: string,
    options: {
      port?: number;
      database?: string;
      type?: string;
      ssl?: boolean;
    } = {},
  ): Promise<any> {
    const connectionId = `${username}@${connectionString}`;
    this.logger.log(`Connecting to database: ${connectionId}`);
    
    try {
      // Check if we already have an active connection
      if (this.activeConnections.has(connectionId)) {
        this.logger.log(`Reusing existing connection: ${connectionId}`);
        return this.activeConnections.get(connectionId);
      }
      
      // Set default port based on detected database type
      if (!options.port) {
        const dbTypeLower = options.type?.toLowerCase() || '';
        if (dbTypeLower === 'oracle') {
          options.port = 1521;
        } else if (dbTypeLower === 'postgres' || dbTypeLower === 'postgresql') {
          options.port = 5432;
        } else if (dbTypeLower === 'mysql') {
          options.port = 3306;
        } else if (dbTypeLower === 'mssql' || dbTypeLower === 'sqlserver') {
          options.port = 1433;
        } else {
          // Try to infer from connection string
          if (connectionString.includes(':1521:') || connectionString.includes('oracle')) {
            options.port = 1521;
          } else if (connectionString.includes(':5432:') || connectionString.includes('postgres')) {
            options.port = 5432;
          } else if (connectionString.includes(':3306:') || connectionString.includes('mysql')) {
            options.port = 3306;
          } else if (connectionString.includes(':1433:') || connectionString.includes('sqlserver')) {
            options.port = 1433;
          } else {
            // Default to Oracle port if we can't determine
            options.port = 1521;
          }
        }
      }
      
      // Create connection config based on the database type
      const connectionConfig: any = {
        username,
        password,
        connectionString,
        host: connectionString.split(':')[0], // Extract host from connection string
        port: options.port,
        database: options.database,
        ssl: options.ssl
      };
      
      // Try to detect the database type if not explicitly provided
      const dbType = options.type 
        ? this.databaseFactoryService.detectDatabaseType({ type: options.type }) 
        : this.databaseFactoryService.detectDatabaseType({ connectionString });
      
      this.logger.log(`Detected database type: ${dbType}`);
      
      // Get the appropriate provider
      const provider = this.databaseFactoryService.createProvider(dbType);
      this.activeProviders.set(connectionId, provider);
      
      // Connect using the provider
      const connection = await provider.connect(connectionConfig);
      
      // Store the connection for reuse
      this.activeConnections.set(connectionId, connection);
      this.logger.log(`Connected successfully to ${dbType} database: ${connectionId}`);
      
      return connection;
    } catch (error) {
      this.logger.error(`Connection failed: ${error.message}`);
      throw new Error(`Failed to connect to database: ${error.message}`);
    }
  }

  /**
   * Execute a SQL query on a database connection with timeout
   * Works with any supported database type
   */
  async executeQuery(
    connection: any,
    sql: string,
    timeoutMs: number = 10000, // Default 10 second timeout
  ): Promise<any[]> {
    try {
      // Check if query is safe
      if (!this.isSafeSqlQuery(sql)) {
        this.logger.warn(`Unsafe SQL query rejected: ${sql}`);
        throw new Error('Unsafe SQL query. Destructive operations are not allowed.');
      }
      
      // Process the SQL query
      let processedSql = sql.trim();
      
      // Some database systems don't accept trailing semicolons
      if (processedSql.endsWith(';')) {
        processedSql = processedSql.substring(0, processedSql.length - 1);
      }
      
      this.logger.log(`Executing SQL query: ${processedSql}`);
      
      // Find the connection ID to get the appropriate provider
      let provider: DatabaseProvider = null;
      
      // Search for this connection in our active connections
      for (const [connectionId, conn] of this.activeConnections.entries()) {
        if (conn === connection) {
          provider = this.activeProviders.get(connectionId);
          break;
        }
      }
      
      if (!provider) {
        // If we can't find the provider, assume it's an Oracle connection (for backward compatibility)
        this.logger.warn('Provider not found for connection, assuming Oracle');
        
        // For Oracle connections, use the legacy method which is compatible with older code
        if (typeof connection.execute === 'function') {
          const options = {
            maxRows: 100,
            outFormat: oracledb.OUT_FORMAT_OBJECT
          };
          
          const result = await connection.execute(processedSql, {}, options);
          return result.rows || [];
        } else {
          throw new Error('Unknown connection type, cannot execute query');
        }
      }
      
      // Execute the query using the provider
      return await provider.executeQuery(connection, processedSql, timeoutMs);
    } catch (error) {
      this.logger.error(`Error executing SQL query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close a database connection
   * Works with any supported database type
   */
  async closeConnection(connection: any): Promise<void> {
    try {
      // Find the connection ID to get the appropriate provider
      let provider: DatabaseProvider = null;
      let connectionId: string = null;
      
      // Search for this connection in our active connections
      for (const [connId, conn] of this.activeConnections.entries()) {
        if (conn === connection) {
          provider = this.activeProviders.get(connId);
          connectionId = connId;
          break;
        }
      }
      
      if (!provider) {
        // If we can't find the provider, assume it's an Oracle connection (for backward compatibility)
        this.logger.warn('Provider not found for connection, assuming Oracle');
        
        // For Oracle connections, use the legacy method which is compatible with older code
        if (typeof connection.close === 'function') {
          await connection.close();
          this.logger.log('Oracle database connection closed successfully');
        } else {
          throw new Error('Unknown connection type, cannot close connection');
        }
      } else {
        // Close using the provider
        await provider.closeConnection(connection);
        this.logger.log('Database connection closed successfully');
        
        // Remove from maps
        if (connectionId) {
          this.activeConnections.delete(connectionId);
          this.activeProviders.delete(connectionId);
        }
      }
    } catch (error) {
      this.logger.error(`Error closing database connection: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if a SQL query is safe to execute
   * Prevents destructive operations like DROP, DELETE, UPDATE without WHERE, etc.
   */
  isSafeSqlQuery(sql: string): boolean {
    const sanitizedSql = sql.trim().toUpperCase();
    
    // Block potentially destructive operations
    const dangerousOperations = [
      'DROP TABLE',
      'DROP DATABASE',
      'TRUNCATE TABLE',
      'DELETE FROM',
      'UPDATE',
      'ALTER TABLE',
      'CREATE USER',
      'GRANT ',
      'REVOKE ',
    ];

    // Check for dangerous operations
    for (const operation of dangerousOperations) {
      if (sanitizedSql.includes(operation)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get comprehensive database metadata including tables, columns, constraints and sample data
   * Works with any supported database type
   */
  async getDatabaseMetadata(connection: any): Promise<any> {
    try {
      this.logger.log('Starting optimized database metadata scan (high-performance version)');
      
      // Get database basic information first
      const dbInfo = await this.getBasicDatabaseInfo(connection);
      const dbType = dbInfo.type.toLowerCase();
      
      // Get tables with actual data first (most likely to be useful)
      let tables = [];
      let tablesQuery = '';
      
      // Database-specific queries to get tables
      if (dbType === 'oracle') {
        // Oracle-specific query
        tablesQuery = `
          SELECT owner, table_name, num_rows 
          FROM all_tables 
          WHERE owner NOT IN ('SYS', 'SYSTEM', 'MDSYS', 'CTXSYS', 'DBSNMP', 'OUTLN', 'XDB', 'APEX_040200', 'WMSYS')
          AND num_rows > 0 
          ORDER BY num_rows DESC
        `;
      }
      else if (dbType === 'postgresql') {
        // PostgreSQL-specific query
        tablesQuery = `
          SELECT 
            schemaname AS owner, 
            tablename AS table_name,
            n_live_tup AS num_rows
          FROM 
            pg_stat_user_tables
          WHERE 
            schemaname NOT IN ('pg_catalog', 'information_schema')
          ORDER BY 
            n_live_tup DESC NULLS LAST
        `;
      }
      else if (dbType === 'mysql') {
        // MySQL-specific query
        tablesQuery = `
          SELECT 
            table_schema AS owner, 
            table_name,
            table_rows AS num_rows
          FROM 
            information_schema.tables
          WHERE 
            table_schema NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
            AND table_type = 'BASE TABLE'
          ORDER BY 
            table_rows DESC
        `;
      }
      else if (dbType === 'mssql') {
        // SQL Server-specific query
        tablesQuery = `
          SELECT 
            s.name AS owner,
            t.name AS table_name,
            p.rows AS num_rows
          FROM 
            sys.tables t
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            INNER JOIN sys.indexes i ON t.object_id = i.object_id
            INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
          WHERE 
            i.index_id <= 1
            AND s.name NOT IN ('sys', 'guest', 'INFORMATION_SCHEMA')
          ORDER BY 
            p.rows DESC
        `;
      }
      else {
        // Generic fallback for unknown database types
        tablesQuery = `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'sys')
          LIMIT 50
        `;
      }
      
      try {
        // Execute the query to get tables
        tables = await this.executeQuery(connection, tablesQuery, 10000);
        this.logger.log(`Found ${tables.length} non-system tables with data using ${dbType}-specific query`);
      } catch (error) {
        this.logger.warn(`Error executing ${dbType} table query: ${error.message}`);
        tables = [];
      }
      
      // If no tables found, try alternative methods based on database type
      if (tables.length === 0) {
        if (dbType === 'oracle') {
          // Try user's own tables for Oracle
          const userTablesQuery = `
            SELECT USER as owner, table_name, num_rows 
            FROM user_tables 
            ORDER BY table_name
          `;
          
          try {
            tables = await this.executeQuery(connection, userTablesQuery, 5000);
            this.logger.log(`Found ${tables.length} tables owned by current Oracle user`);
          } catch (error) {
            this.logger.warn(`Error getting user tables: ${error.message}`);
          }
        }
        else if (dbType === 'postgresql') {
          // Try current schema tables for PostgreSQL
          const userTablesQuery = `
            SELECT 
              current_schema() AS owner,
              tablename AS table_name
            FROM 
              pg_tables
            WHERE 
              schemaname = current_schema()
            ORDER BY 
              tablename
          `;
          
          try {
            tables = await this.executeQuery(connection, userTablesQuery, 5000);
            this.logger.log(`Found ${tables.length} tables in current PostgreSQL schema`);
          } catch (error) {
            this.logger.warn(`Error getting current schema tables: ${error.message}`);
          }
        }
        else if (dbType === 'mysql') {
          // Try current database tables for MySQL
          const userTablesQuery = `SHOW TABLES`;
          
          try {
            const rawTables = await this.executeQuery(connection, userTablesQuery, 5000);
            // Format the results to match our expected structure
            tables = rawTables.map(row => {
              const tableName = Object.values(row)[0];
              return {
                owner: dbInfo.name,
                table_name: tableName,
                num_rows: 0
              };
            });
            this.logger.log(`Found ${tables.length} tables in current MySQL database`);
          } catch (error) {
            this.logger.warn(`Error getting MySQL tables: ${error.message}`);
          }
        }
        else if (dbType === 'mssql') {
          // Try dbo schema tables for SQL Server
          const userTablesQuery = `
            SELECT 
              'dbo' AS owner,
              name AS table_name,
              0 AS num_rows
            FROM 
              sys.tables
            WHERE 
              schema_id = SCHEMA_ID('dbo')
            ORDER BY 
              name
          `;
          
          try {
            tables = await this.executeQuery(connection, userTablesQuery, 5000);
            this.logger.log(`Found ${tables.length} tables in SQL Server dbo schema`);
          } catch (error) {
            this.logger.warn(`Error getting SQL Server tables: ${error.message}`);
          }
        }
      }
      
      // If still no tables, try a generic approach
      if (tables.length === 0) {
        // Generic fallback query that might work across different database types
        const fallbackTablesQuery = dbType === 'oracle' 
          ? `SELECT owner, table_name FROM all_tables WHERE ROWNUM <= 50 ORDER BY owner, table_name`
          : `SELECT table_schema AS owner, table_name FROM information_schema.tables LIMIT 50`;
        
        try {
          tables = await this.executeQuery(connection, fallbackTablesQuery, 5000);
          this.logger.log(`Falling back to generic query, found ${tables.length} tables`);
        } catch (error) {
          this.logger.warn(`Error with fallback query: ${error.message}`);
        }
        
        // If still no tables, use dictionary views or return empty metadata
        if (tables.length === 0) {
          this.logger.log('No accessible tables found');
          if (dbType === 'oracle') {
            return this.getDictionaryViewsMetadata(connection);
          } else {
            return {
              database: dbInfo,
              tables: [],
              relationships: [],
              tableCount: 0,
              processedTables: 0
            };
          }
        }
      }
      
      // Limit and prioritize to most important tables (those with data)
      // or those most likely to contain real application data
      let tablesToProcess = tables.slice(0, 15); // Dramatically limit the tables we scan deeply
      
      // Get detailed info for a limited set of tables
      const detailedMetadata = await this.getTableDetailsOptimized(connection, tablesToProcess);
      
      // Get basic relationships without full scan
      const relationships = await this.getBasicRelationships(connection, tablesToProcess);
      
      return {
        database: dbInfo,
        tableCount: tables.length,
        processedTables: tablesToProcess.length,
        tables: detailedMetadata,
        relationships: relationships
      };
    } catch (error) {
      this.logger.error(`Error getting database metadata: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get basic database information with minimal queries
   * This method detects the database type and executes appropriate queries
   */
  private async getBasicDatabaseInfo(connection: any): Promise<any> {
    try {
      // Detect database type from connection object properties
      let dbType = 'Unknown';
      let dbName = 'Unknown';
      let currentSchema = 'Unknown';
      let version = 'Unknown';
      
      // Try to detect database type from connection object
      if (connection.oracleServerVersion) {
        dbType = 'Oracle';
        
        // Get Oracle-specific information
        try {
          const nameQuery = `SELECT SYS_CONTEXT('USERENV', 'DB_NAME') as DB_NAME FROM dual`;
          const nameResult = await this.executeQuery(connection, nameQuery, 3000);
          dbName = nameResult.length > 0 ? nameResult[0].DB_NAME : 'Unknown';
          
          const schemaQuery = `SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') as CURRENT_SCHEMA FROM dual`;
          const schemaResult = await this.executeQuery(connection, schemaQuery, 3000);
          currentSchema = schemaResult.length > 0 ? schemaResult[0].CURRENT_SCHEMA : 'Unknown';
          
          const versionQuery = `SELECT BANNER as VERSION FROM v$version WHERE ROWNUM = 1`;
          const versionResult = await this.executeQuery(connection, versionQuery, 3000);
          version = versionResult.length > 0 ? versionResult[0].VERSION : 'Unknown';
        } catch (error) {
          this.logger.warn(`Could not get Oracle database details: ${error.message}`);
        }
      } 
      else if (connection.pgVersion || (connection.connectionParameters && connection.connectionParameters.database)) {
        dbType = 'PostgreSQL';
        
        // Get PostgreSQL-specific information
        try {
          const nameQuery = `SELECT current_database() as db_name`;
          const nameResult = await this.executeQuery(connection, nameQuery, 3000);
          dbName = nameResult.length > 0 ? nameResult[0].db_name : 'Unknown';
          
          const schemaQuery = `SELECT current_schema() as current_schema`;
          const schemaResult = await this.executeQuery(connection, schemaQuery, 3000);
          currentSchema = schemaResult.length > 0 ? schemaResult[0].current_schema : 'Unknown';
          
          const versionQuery = `SELECT version() as version`;
          const versionResult = await this.executeQuery(connection, versionQuery, 3000);
          version = versionResult.length > 0 ? versionResult[0].version : 'Unknown';
        } catch (error) {
          this.logger.warn(`Could not get PostgreSQL database details: ${error.message}`);
        }
      }
      else if (connection.config && connection.config.database) {
        // Check further for MySQL vs MSSQL
        if (connection.config.socketPath || connection.config.charset) {
          dbType = 'MySQL';
          
          // Get MySQL-specific information
          try {
            const nameQuery = `SELECT DATABASE() as db_name`;
            const nameResult = await this.executeQuery(connection, nameQuery, 3000);
            dbName = nameResult.length > 0 ? nameResult[0].db_name : 'Unknown';
            
            const versionQuery = `SELECT VERSION() as version`;
            const versionResult = await this.executeQuery(connection, versionQuery, 3000);
            version = versionResult.length > 0 ? versionResult[0].version : 'Unknown';
            
            // MySQL doesn't have schemas in the same way, use database name
            currentSchema = dbName;
          } catch (error) {
            this.logger.warn(`Could not get MySQL database details: ${error.message}`);
          }
        } 
        else if (connection.config.server || connection.config.options) {
          dbType = 'MSSQL';
          
          // Get MSSQL-specific information
          try {
            const nameQuery = `SELECT DB_NAME() as db_name`;
            const nameResult = await this.executeQuery(connection, nameQuery, 3000);
            dbName = nameResult.length > 0 ? nameResult[0].db_name : 'Unknown';
            
            const schemaQuery = `SELECT SCHEMA_NAME() as current_schema`;
            const schemaResult = await this.executeQuery(connection, schemaQuery, 3000);
            currentSchema = schemaResult.length > 0 ? schemaResult[0].current_schema : 'Unknown';
            
            const versionQuery = `SELECT @@VERSION as version`;
            const versionResult = await this.executeQuery(connection, versionQuery, 3000);
            version = versionResult.length > 0 ? versionResult[0].version : 'Unknown';
          } catch (error) {
            this.logger.warn(`Could not get MSSQL database details: ${error.message}`);
          }
        }
      }
      
      return {
        type: dbType,
        name: dbName,
        currentSchema,
        version
      };
    } catch (error) {
      this.logger.error(`Error getting basic database info: ${error.message}`);
      return { type: 'Unknown' };
    }
  }
  
  /**
   * Get optimized table details for a limited set of tables
   * This method is database-type aware and uses appropriate queries for each database
   */
  private async getTableDetailsOptimized(connection: any, tables: any[]): Promise<any[]> {
    const detailedMetadata = [];
    
    if (tables.length === 0) {
      return detailedMetadata;
    }
    
    // Get database type info first
    const dbInfo = await this.getBasicDatabaseInfo(connection);
    const dbType = dbInfo.type.toLowerCase();
    
    for (const table of tables) {
      try {
        // Normalize table structure across database types
        const tableName = table.table_name || table.TABLE_NAME || '';
        const tableOwner = table.owner || table.OWNER || table.schema || '';
        
        if (!tableName) {
          this.logger.warn('Skipping table with no name');
          continue;
        }
        
        this.logger.log(`Getting optimized metadata for ${tableOwner}.${tableName}`);
        
        // Variables for storing table details
        let columns = [];
        let primaryKey = [];
        let sampleData = [];
        let columnQuery = '';
        let pkQuery = '';
        let sampleQuery = '';
        
        // Database-specific column queries
        if (dbType === 'oracle') {
          // Oracle column query
          columnQuery = `
            SELECT 
              column_name, 
              data_type, 
              data_length, 
              nullable, 
              column_id
            FROM all_tab_columns 
            WHERE table_name = '${tableName}' 
            AND owner = '${tableOwner}'
            ORDER BY column_id
          `;
          
          // Oracle primary key query
          pkQuery = `
            SELECT cols.column_name
            FROM all_constraints cons, all_cons_columns cols
            WHERE cons.constraint_type = 'P'
            AND cons.table_name = '${tableName}'
            AND cons.owner = '${tableOwner}'
            AND cons.constraint_name = cols.constraint_name
            AND cons.owner = cols.owner
            ORDER BY cols.position
          `;
          
          // Oracle sample data query with ROWNUM
          sampleQuery = `
            SELECT * FROM ${tableOwner}.${tableName}
            WHERE ROWNUM <= 5
          `;
        } 
        else if (dbType === 'postgresql') {
          // PostgreSQL column query
          columnQuery = `
            SELECT 
              column_name, 
              data_type, 
              character_maximum_length AS data_length,
              numeric_precision AS data_precision,
              numeric_scale AS data_scale, 
              is_nullable AS nullable,
              ordinal_position AS column_id
            FROM information_schema.columns
            WHERE table_name = '${tableName}'
            AND table_schema = '${tableOwner}'
            ORDER BY ordinal_position
          `;
          
          // PostgreSQL primary key query
          pkQuery = `
            SELECT 
              kcu.column_name
            FROM 
              information_schema.table_constraints AS tc
              JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE 
              tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = '${tableOwner}'
              AND tc.table_name = '${tableName}'
            ORDER BY 
              kcu.ordinal_position
          `;
          
          // PostgreSQL sample data query with LIMIT
          sampleQuery = `
            SELECT * FROM "${tableOwner}"."${tableName}"
            LIMIT 5
          `;
        }
        else if (dbType === 'mysql') {
          // MySQL column query
          columnQuery = `
            SELECT 
              COLUMN_NAME AS column_name, 
              DATA_TYPE AS data_type, 
              CHARACTER_MAXIMUM_LENGTH AS data_length,
              NUMERIC_PRECISION AS data_precision,
              NUMERIC_SCALE AS data_scale,
              IS_NULLABLE AS nullable,
              ORDINAL_POSITION AS column_id
            FROM information_schema.COLUMNS
            WHERE TABLE_NAME = '${tableName}'
            AND TABLE_SCHEMA = '${tableOwner || dbInfo.name}'
            ORDER BY ORDINAL_POSITION
          `;
          
          // MySQL primary key query
          pkQuery = `
            SELECT 
              COLUMN_NAME AS column_name
            FROM 
              information_schema.KEY_COLUMN_USAGE
            WHERE 
              CONSTRAINT_NAME = 'PRIMARY'
              AND TABLE_SCHEMA = '${tableOwner || dbInfo.name}'
              AND TABLE_NAME = '${tableName}'
            ORDER BY 
              ORDINAL_POSITION
          `;
          
          // MySQL sample data query with LIMIT
          sampleQuery = `
            SELECT * FROM \`${tableOwner || dbInfo.name}\`.\`${tableName}\`
            LIMIT 5
          `;
        }
        else if (dbType === 'mssql') {
          // SQL Server column query
          columnQuery = `
            SELECT 
              c.name AS column_name, 
              t.name AS data_type,
              c.max_length AS data_length,
              c.precision AS data_precision,
              c.scale AS data_scale,
              CASE WHEN c.is_nullable = 1 THEN 'Y' ELSE 'N' END AS nullable,
              c.column_id
            FROM 
              sys.columns c
              INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
              INNER JOIN sys.tables tbl ON c.object_id = tbl.object_id
              INNER JOIN sys.schemas s ON tbl.schema_id = s.schema_id
            WHERE 
              tbl.name = '${tableName}'
              AND s.name = '${tableOwner}'
            ORDER BY 
              c.column_id
          `;
          
          // SQL Server primary key query
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
              AND t.name = '${tableName}'
              AND s.name = '${tableOwner}'
            ORDER BY 
              ic.key_ordinal
          `;
          
          // SQL Server sample data query with TOP
          sampleQuery = `
            SELECT TOP 5 * FROM [${tableOwner}].[${tableName}]
          `;
        }
        else {
          // Generic fallback for unknown database types
          columnQuery = `
            SELECT 
              column_name, 
              data_type
            FROM information_schema.columns
            WHERE table_name = '${tableName}'
            LIMIT 50
          `;
        }
        
        // Execute column query
        try {
          columns = await this.executeQuery(connection, columnQuery, 5000);
          
          // Normalize column names across database types
          columns = columns.map(col => ({
            COLUMN_NAME: col.column_name || col.COLUMN_NAME,
            DATA_TYPE: col.data_type || col.DATA_TYPE,
            DATA_LENGTH: col.data_length || col.DATA_LENGTH,
            DATA_PRECISION: col.data_precision || col.DATA_PRECISION,
            DATA_SCALE: col.data_scale || col.DATA_SCALE,
            NULLABLE: 
              col.nullable === 'YES' || col.nullable === 'Y' || col.nullable === true ? 'Y' : 
              col.nullable === 'NO' || col.nullable === 'N' || col.nullable === false ? 'N' : 
              col.NULLABLE,
            COLUMN_ID: col.column_id || col.COLUMN_ID
          }));
        } catch (error) {
          this.logger.warn(`Error getting columns for ${tableOwner}.${tableName}: ${error.message}`);
          columns = [];
        }
        
        // Get primary key if we have a valid query
        if (pkQuery) {
          try {
            const pkColumns = await this.executeQuery(connection, pkQuery, 3000);
            primaryKey = pkColumns.map(row => row.column_name || row.COLUMN_NAME);
          } catch (error) {
            this.logger.warn(`Error getting primary key for ${tableOwner}.${tableName}: ${error.message}`);
            primaryKey = [];
          }
        }
        
        // Get sample data only if we have columns
        if (columns.length > 0 && columns.length < 50 && sampleQuery) {
          try {
            sampleData = await this.executeQuery(connection, sampleQuery, 5000);
            // Limit the amount of data to avoid overwhelming the response
            if (sampleData.length > 0) {
              // Only keep first 5 rows
              sampleData = sampleData.slice(0, 5);
            }
          } catch (error) {
            this.logger.warn(`Error getting sample data for ${tableOwner}.${tableName}: ${error.message}`);
            sampleData = [];
          }
        }
        
        detailedMetadata.push({
          owner: tableOwner,
          tableName,
          rowCount: table.num_rows || table.NUM_ROWS || 0,
          columns,
          primaryKey,
          sampleData
        });
      } catch (error) {
        const tableName = table.table_name || table.TABLE_NAME || 'unknown';
        const tableOwner = table.owner || table.OWNER || table.schema || 'unknown';
        this.logger.error(`Error processing table ${tableOwner}.${tableName}: ${error.message}`);
        // Continue to next table
      }
    }
    
    return detailedMetadata;
  }
  
  /**
   * Get basic relationships without full scan
   * This method is database-type aware and uses appropriate queries for each database
   */
  private async getBasicRelationships(connection: any, tables: any[]): Promise<any[]> {
    const relationships = [];
    
    try {
      if (tables.length === 0) {
        return relationships;
      }
      
      // Get database type info first
      const dbInfo = await this.getBasicDatabaseInfo(connection);
      const dbType = dbInfo.type.toLowerCase();
      
      // Normalize table names and owners across different database types
      const normalizedTables = tables.map(t => ({
        tableName: t.table_name || t.TABLE_NAME,
        owner: t.owner || t.OWNER || t.schema
      }));
      
      // Build a list of table names and schema names for queries
      const tableNames = normalizedTables.map(t => `'${t.tableName}'`).join(',');
      const schemaNames = [...new Set(normalizedTables.map(t => t.owner))].map(s => `'${s}'`).join(',');
      
      if (!tableNames || !schemaNames) {
        return relationships;
      }
      
      let fkQuery = '';
      
      // Database-specific foreign key queries
      if (dbType === 'oracle') {
        // Oracle foreign key query
        fkQuery = `
          SELECT 
            cons.owner as schema_name,
            cons.table_name as table_name,
            cols.column_name as column_name,
            cons.r_owner as r_schema_name,
            r_cons.table_name as r_table_name,
            r_cols.column_name as r_column_name
          FROM 
            all_constraints cons
            JOIN all_cons_columns cols ON cons.constraint_name = cols.constraint_name AND cons.owner = cols.owner
            JOIN all_constraints r_cons ON cons.r_constraint_name = r_cons.constraint_name AND cons.r_owner = r_cons.owner
            JOIN all_cons_columns r_cols ON r_cons.constraint_name = r_cols.constraint_name AND r_cons.owner = r_cols.owner
          WHERE 
            cons.constraint_type = 'R'
            AND cons.table_name IN (${tableNames})
            AND cons.owner IN (${schemaNames})
        `;
      }
      else if (dbType === 'postgresql') {
        // PostgreSQL foreign key query
        fkQuery = `
          SELECT
            tc.table_schema AS schema_name,
            tc.table_name AS table_name,
            kcu.column_name AS column_name,
            ccu.table_schema AS r_schema_name,
            ccu.table_name AS r_table_name,
            ccu.column_name AS r_column_name
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
            AND tc.table_name IN (${tableNames})
            AND tc.table_schema IN (${schemaNames})
        `;
      }
      else if (dbType === 'mysql') {
        // MySQL foreign key query using information_schema
        fkQuery = `
          SELECT 
            kcu.table_schema AS schema_name,
            kcu.table_name AS table_name,
            kcu.column_name AS column_name,
            kcu.referenced_table_schema AS r_schema_name,
            kcu.referenced_table_name AS r_table_name,
            kcu.referenced_column_name AS r_column_name
          FROM 
            information_schema.key_column_usage kcu
          WHERE 
            kcu.referenced_table_name IS NOT NULL
            AND kcu.table_name IN (${tableNames})
            AND kcu.table_schema IN (${schemaNames})
        `;
      }
      else if (dbType === 'mssql') {
        // SQL Server foreign key query
        fkQuery = `
          SELECT 
            schema_name(fk.schema_id) AS schema_name,
            object_name(fk.parent_object_id) AS table_name,
            col_name(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
            schema_name(pk.schema_id) AS r_schema_name,
            object_name(fk.referenced_object_id) AS r_table_name,
            col_name(fkc.referenced_object_id, fkc.referenced_column_id) AS r_column_name
          FROM 
            sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            INNER JOIN sys.tables pk ON fk.referenced_object_id = pk.object_id
          WHERE 
            object_name(fk.parent_object_id) IN (${tableNames})
            AND schema_name(fk.schema_id) IN (${schemaNames})
        `;
      }
      else {
        // Generic fallback using information_schema (might work for some databases)
        fkQuery = `
          SELECT 
            tc.table_schema AS schema_name,
            tc.table_name AS table_name,
            kcu.column_name AS column_name,
            ccu.table_schema AS r_schema_name,
            ccu.table_name AS r_table_name,
            ccu.column_name AS r_column_name
          FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
          WHERE 
            tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name IN (${tableNames})
          LIMIT 100
        `;
      }
      
      // Execute the foreign key query
      let foreignKeys = [];
      try {
        foreignKeys = await this.executeQuery(connection, fkQuery, 8000);
        this.logger.log(`Found ${foreignKeys.length} foreign key relationships for the tables`);
      } catch (error) {
        this.logger.warn(`Error executing foreign key query: ${error.message}`);
        // Try a simplified fallback if available
        if (dbType === 'oracle') {
          try {
            // Simplified Oracle query with fewer joins
            const simpleFkQuery = `
              SELECT 
                a.owner as schema_name,
                a.table_name as table_name,
                a.column_name as column_name,
                c_pk.owner as r_schema_name,
                c_pk.table_name as r_table_name, 
                c_pk.column_name as r_column_name
              FROM 
                all_cons_columns a
                JOIN all_constraints c ON a.owner = c.owner AND a.constraint_name = c.constraint_name
                JOIN all_constraints c_pk ON c.r_owner = c_pk.owner AND c.r_constraint_name = c_pk.constraint_name
                JOIN all_cons_columns c_pk_col ON c_pk.owner = c_pk_col.owner AND c_pk.constraint_name = c_pk_col.constraint_name
              WHERE 
                c.constraint_type = 'R'
                AND rownum <= 100
            `;
            foreignKeys = await this.executeQuery(connection, simpleFkQuery, 5000);
            this.logger.log(`Found ${foreignKeys.length} relationships with simplified query`);
          } catch (fallbackError) {
            this.logger.warn(`Fallback relationship query also failed: ${fallbackError.message}`);
          }
        }
      }
      
      // Normalize column names and process foreign keys into relationship objects
      for (const fk of foreignKeys) {
        try {
          // Extract field values with fallbacks for different case conventions
          const sourceName = fk.table_name || fk.TABLE_NAME;
          const sourceSchema = fk.schema_name || fk.SCHEMA_NAME;
          const sourceColumn = fk.column_name || fk.COLUMN_NAME;
          const targetName = fk.r_table_name || fk.R_TABLE_NAME;
          const targetSchema = fk.r_schema_name || fk.R_SCHEMA_NAME;
          const targetColumn = fk.r_column_name || fk.R_COLUMN_NAME;
          
          // Only add valid relationships
          if (sourceName && sourceColumn && targetName && targetColumn) {
            relationships.push({
              type: 'Foreign Key',
              source: {
                schema: sourceSchema,
                table: sourceName,
                column: sourceColumn
              },
              target: {
                schema: targetSchema,
                table: targetName,
                column: targetColumn
              }
            });
          }
        } catch (parseError) {
          this.logger.warn(`Error parsing foreign key relationship: ${parseError.message}`);
          // Skip this relationship and continue
        }
      }
    } catch (error) {
      this.logger.error(`Error collecting basic relationships: ${error.message}`);
      // Continue with empty relationships
    }
    
    return relationships;
  }
  
  /**
   * Get dictionary views metadata when no regular tables are accessible
   */
  private async getDictionaryViewsMetadata(connection: any): Promise<any> {
    // Return metadata about key dictionary views for system exploration
    const dictionaryViews = [
      {
        owner: 'SYS',
        tableName: 'ALL_TABLES',
        type: 'VIEW',
        description: 'Information about all tables accessible to the current user',
        columns: [
          { COLUMN_NAME: 'OWNER', DATA_TYPE: 'VARCHAR2', NULLABLE: 'N', DESCRIPTION: 'Table owner' },
          { COLUMN_NAME: 'TABLE_NAME', DATA_TYPE: 'VARCHAR2', NULLABLE: 'N', DESCRIPTION: 'Table name' },
          { COLUMN_NAME: 'TABLESPACE_NAME', DATA_TYPE: 'VARCHAR2', NULLABLE: 'Y', DESCRIPTION: 'Tablespace name' },
          { COLUMN_NAME: 'NUM_ROWS', DATA_TYPE: 'NUMBER', NULLABLE: 'Y', DESCRIPTION: 'Number of rows' }
        ]
      },
      {
        owner: 'SYS',
        tableName: 'ALL_TAB_COLUMNS',
        type: 'VIEW',
        description: 'Columns of all tables accessible to the current user',
        columns: [
          { COLUMN_NAME: 'OWNER', DATA_TYPE: 'VARCHAR2', NULLABLE: 'N', DESCRIPTION: 'Table owner' },
          { COLUMN_NAME: 'TABLE_NAME', DATA_TYPE: 'VARCHAR2', NULLABLE: 'N', DESCRIPTION: 'Table name' },
          { COLUMN_NAME: 'COLUMN_NAME', DATA_TYPE: 'VARCHAR2', NULLABLE: 'N', DESCRIPTION: 'Column name' },
          { COLUMN_NAME: 'DATA_TYPE', DATA_TYPE: 'VARCHAR2', NULLABLE: 'Y', DESCRIPTION: 'Data type' },
          { COLUMN_NAME: 'DATA_LENGTH', DATA_TYPE: 'NUMBER', NULLABLE: 'Y', DESCRIPTION: 'Length in bytes' },
          { COLUMN_NAME: 'NULLABLE', DATA_TYPE: 'VARCHAR2', NULLABLE: 'Y', DESCRIPTION: 'Is nullable?' }
        ]
      },
      {
        owner: 'SYS', 
        tableName: 'ALL_CONSTRAINTS',
        type: 'VIEW',
        description: 'Constraint definitions on all tables accessible to the current user',
        columns: [
          { COLUMN_NAME: 'OWNER', DATA_TYPE: 'VARCHAR2', NULLABLE: 'N', DESCRIPTION: 'Owner of the constraint' },
          { COLUMN_NAME: 'CONSTRAINT_NAME', DATA_TYPE: 'VARCHAR2', NULLABLE: 'N', DESCRIPTION: 'Name of the constraint' },
          { COLUMN_NAME: 'TABLE_NAME', DATA_TYPE: 'VARCHAR2', NULLABLE: 'N', DESCRIPTION: 'Table with constraint' },
          { COLUMN_NAME: 'CONSTRAINT_TYPE', DATA_TYPE: 'VARCHAR2', NULLABLE: 'Y', DESCRIPTION: 'Type: P (primary key), U (unique), C (check), R (referential integrity)' }
        ]
      },
      {
        owner: 'SYS',
        tableName: 'ALL_VIEWS', 
        type: 'VIEW',
        description: 'Description of views accessible to the current user',
        columns: [
          { COLUMN_NAME: 'OWNER', DATA_TYPE: 'VARCHAR2', NULLABLE: 'N', DESCRIPTION: 'Owner of the view' },
          { COLUMN_NAME: 'VIEW_NAME', DATA_TYPE: 'VARCHAR2', NULLABLE: 'N', DESCRIPTION: 'Name of the view' },
          { COLUMN_NAME: 'TEXT_LENGTH', DATA_TYPE: 'NUMBER', NULLABLE: 'Y', DESCRIPTION: 'Length of the view text' }
        ]
      }
    ];
    
    // Try to get some sample data from each dictionary view
    for (const view of dictionaryViews) {
      try {
        const sampleQuery = `SELECT * FROM ${view.owner}.${view.tableName} WHERE ROWNUM <= 5`;
        const sampleData = await this.executeQuery(connection, sampleQuery, 5000);
        view['sampleData'] = sampleData;
      } catch (error) {
        this.logger.warn(`Could not get sample data for ${view.owner}.${view.tableName}: ${error.message}`);
        view['sampleData'] = [];
      }
    }
    
    return {
      database: {
        type: 'Oracle',
        note: 'Limited access to regular tables - using dictionary views',
      },
      tableCount: 0,
      processedTables: 0,
      tables: dictionaryViews,
      relationships: []
    };
  }
  
  /**
   * Collect detailed metadata for a list of tables
   */
  private async collectDetailedTableMetadata(connection: any, tables: any[]): Promise<any[]> {
    const detailedMetadata = [];
    
    for (const table of tables) {
      try {
        const tableName = table.TABLE_NAME;
        const tableOwner = table.OWNER;
        
        this.logger.log(`Processing detailed metadata for table: ${tableOwner}.${tableName}`);
        
        // Get column information
        const columnQuery = `
          SELECT 
            column_name, 
            data_type, 
            data_length, 
            data_precision, 
            data_scale,
            nullable, 
            column_id
          FROM all_tab_columns 
          WHERE table_name = '${tableName}' 
          AND owner = '${tableOwner}'
          ORDER BY column_id
        `;
        
        const columns = await this.executeQuery(connection, columnQuery, 5000);
        
        // Get table comments
        let tableComment = '';
        try {
          const commentQuery = `
            SELECT comments 
            FROM all_tab_comments 
            WHERE table_name = '${tableName}' 
            AND owner = '${tableOwner}'
          `;
          
          const comments = await this.executeQuery(connection, commentQuery, 3000);
          if (comments.length > 0 && comments[0].COMMENTS) {
            tableComment = comments[0].COMMENTS;
          }
        } catch (error) {
          this.logger.warn(`Could not get comment for ${tableOwner}.${tableName}: ${error.message}`);
        }
        
        // Get column comments
        for (const column of columns) {
          try {
            const colCommentQuery = `
              SELECT comments 
              FROM all_col_comments 
              WHERE table_name = '${tableName}' 
              AND owner = '${tableOwner}'
              AND column_name = '${column.COLUMN_NAME}'
            `;
            
            const colComments = await this.executeQuery(connection, colCommentQuery, 3000);
            if (colComments.length > 0 && colComments[0].COMMENTS) {
              column.COMMENT = colComments[0].COMMENTS;
            }
          } catch (error) {
            // Silently continue if column comments can't be retrieved
          }
        }
        
        // Get primary key
        let primaryKey = [];
        try {
          const pkQuery = `
            SELECT cols.column_name
            FROM all_constraints cons, all_cons_columns cols
            WHERE cons.constraint_type = 'P'
            AND cons.table_name = '${tableName}'
            AND cons.owner = '${tableOwner}'
            AND cons.constraint_name = cols.constraint_name
            AND cons.owner = cols.owner
            ORDER BY cols.position
          `;
          
          const pkColumns = await this.executeQuery(connection, pkQuery, 3000);
          primaryKey = pkColumns.map(row => row.COLUMN_NAME);
        } catch (error) {
          this.logger.warn(`Could not get primary key for ${tableOwner}.${tableName}: ${error.message}`);
        }
        
        // Get sample data
        let sampleData = [];
        try {
          // Only get sample data if the table has columns
          if (columns.length > 0) {
            // Build a simple select with column names
            const columnNames = columns.map(c => c.COLUMN_NAME).join(', ');
            const sampleQuery = `
              SELECT ${columnNames}
              FROM ${tableOwner}.${tableName}
              WHERE ROWNUM <= 10
            `;
            
            sampleData = await this.executeQuery(connection, sampleQuery, 5000);
          }
        } catch (error) {
          this.logger.warn(`Could not get sample data for ${tableOwner}.${tableName}: ${error.message}`);
        }
        
        // Get row count estimate
        let rowCount = table.NUM_ROWS || 0;
        if (!rowCount) {
          try {
            const countQuery = `
              SELECT COUNT(*) as ROW_COUNT 
              FROM ${tableOwner}.${tableName}
              WHERE ROWNUM <= 1000
            `;
            
            const countResult = await this.executeQuery(connection, countQuery, 5000);
            rowCount = countResult.length > 0 && countResult[0].ROW_COUNT ? countResult[0].ROW_COUNT : 0;
            if (rowCount === 1000) {
              rowCount = '1000+ (estimated)';
            }
          } catch (error) {
            this.logger.warn(`Could not get row count for ${tableOwner}.${tableName}: ${error.message}`);
          }
        }
        
        // Compile the table metadata
        detailedMetadata.push({
          owner: tableOwner,
          tableName,
          description: tableComment,
          rowCount,
          columns,
          primaryKey,
          sampleData
        });
      } catch (error) {
        this.logger.error(`Error processing metadata for table ${table.OWNER}.${table.TABLE_NAME}: ${error.message}`);
        // Continue to next table
      }
    }
    
    return detailedMetadata;
  }
  
  /**
   * Collect relationship information between tables
   */
  private async collectTableRelationships(connection: any, tables: any[]): Promise<any[]> {
    const relationships = [];
    
    try {
      // Get all foreign key relationships for the tables we're processing
      const tableNames = tables.map(t => `'${t.TABLE_NAME}'`).join(',');
      const schemaNames = [...new Set(tables.map(t => t.OWNER))].map(s => `'${s}'`).join(',');
      
      if (tableNames.length === 0 || schemaNames.length === 0) {
        return relationships;
      }
      
      const fkQuery = `
        SELECT 
          cons.owner as schema_name,
          cons.table_name as table_name,
          cols.column_name as column_name,
          cons.r_owner as r_schema_name,
          r_cons.table_name as r_table_name,
          r_cols.column_name as r_column_name
        FROM 
          all_constraints cons
          JOIN all_cons_columns cols ON cons.constraint_name = cols.constraint_name AND cons.owner = cols.owner
          JOIN all_constraints r_cons ON cons.r_constraint_name = r_cons.constraint_name AND cons.r_owner = r_cons.owner
          JOIN all_cons_columns r_cols ON r_cons.constraint_name = r_cols.constraint_name AND r_cons.owner = r_cols.owner
        WHERE 
          cons.constraint_type = 'R'
          AND (cons.owner IN (${schemaNames}) OR cons.r_owner IN (${schemaNames}))
          AND (cons.table_name IN (${tableNames}) OR r_cons.table_name IN (${tableNames}))
      `;
      
      const foreignKeys = await this.executeQuery(connection, fkQuery, 10000);
      this.logger.log(`Found ${foreignKeys.length} foreign key relationships`);
      
      // Process foreign keys into relationship objects
      for (const fk of foreignKeys) {
        relationships.push({
          type: 'Foreign Key',
          source: {
            schema: fk.SCHEMA_NAME,
            table: fk.TABLE_NAME,
            column: fk.COLUMN_NAME
          },
          target: {
            schema: fk.R_SCHEMA_NAME,
            table: fk.R_TABLE_NAME,
            column: fk.R_COLUMN_NAME
          }
        });
      }
    } catch (error) {
      this.logger.error(`Error collecting table relationships: ${error.message}`);
      // Continue with empty relationships rather than failing
    }
    
    return relationships;
  }
  
  /**
   * Get general database information
   */
  private async getDatabaseInfo(connection: any): Promise<any> {
    try {
      // Get database version
      const versionQuery = `SELECT banner FROM v$version WHERE ROWNUM = 1`;
      const versionResult = await this.executeQuery(connection, versionQuery, 3000);
      const version = versionResult.length > 0 ? versionResult[0].BANNER : 'Unknown';
      
      // Get database name
      const nameQuery = `SELECT SYS_CONTEXT('USERENV', 'DB_NAME') as DB_NAME FROM dual`;
      const nameResult = await this.executeQuery(connection, nameQuery, 3000);
      const dbName = nameResult.length > 0 ? nameResult[0].DB_NAME : 'Unknown';
      
      // Get current schema
      const schemaQuery = `SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') as CURRENT_SCHEMA FROM dual`;
      const schemaResult = await this.executeQuery(connection, schemaQuery, 3000);
      const currentSchema = schemaResult.length > 0 ? schemaResult[0].CURRENT_SCHEMA : 'Unknown';
      
      return {
        type: 'Oracle',
        version,
        name: dbName,
        currentSchema,
        user: connection.oracleServerVersion ? 'Connected' : 'Unknown'
      };
    } catch (error) {
      this.logger.error(`Error getting database info: ${error.message}`);
      return {
        type: 'Oracle',
        note: 'Could not retrieve detailed database information'
      };
    }
  }
}