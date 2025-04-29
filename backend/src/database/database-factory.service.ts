import { Injectable, Logger } from '@nestjs/common';
import { OracleDatabaseProvider } from './providers/oracle-database.provider';
import { PostgresDatabaseProvider } from './providers/postgres-database.provider';
import { MysqlDatabaseProvider } from './providers/mysql-database.provider';
import { MssqlDatabaseProvider } from './providers/mssql-database.provider';
import { DatabaseProvider } from './interfaces/database-provider.interface';

/**
 * Enum for supported database types
 */
export enum DatabaseType {
  ORACLE = 'oracle',
  POSTGRES = 'postgres',
  MYSQL = 'mysql',
  MSSQL = 'mssql'
}

/**
 * Factory service that creates appropriate database providers based on database type
 */
@Injectable()
export class DatabaseFactoryService {
  private readonly logger = new Logger(DatabaseFactoryService.name);
  
  /**
   * Create a database provider instance based on the database type
   * @param type Database type
   * @returns Database provider instance
   */
  createProvider(type: DatabaseType): DatabaseProvider {
    this.logger.log(`Creating database provider for type: ${type}`);
    
    switch (type) {
      case DatabaseType.ORACLE:
        return new OracleDatabaseProvider();
      case DatabaseType.POSTGRES:
        return new PostgresDatabaseProvider();
      case DatabaseType.MYSQL:
        return new MysqlDatabaseProvider();
      case DatabaseType.MSSQL:
        return new MssqlDatabaseProvider();
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }
  
  /**
   * Detect database type from connection details
   * @param config Database connection configuration
   * @returns Detected database type
   */
  detectDatabaseType(config: any): DatabaseType {
    if (config.type) {
      // If type is explicitly provided, use it
      const typeStr = config.type.toLowerCase();
      
      if (typeStr === 'oracle') return DatabaseType.ORACLE;
      if (typeStr === 'postgres' || typeStr === 'postgresql') return DatabaseType.POSTGRES;
      if (typeStr === 'mysql' || typeStr === 'mariadb') return DatabaseType.MYSQL;
      if (typeStr === 'mssql' || typeStr === 'sqlserver') return DatabaseType.MSSQL;
      
      throw new Error(`Unsupported database type: ${config.type}`);
    }
    
    // Try to infer from connection string or other properties
    if (config.connectionString) {
      const connStr = config.connectionString.toLowerCase();
      
      if (connStr.includes('oracle') || connStr.includes(':1521:')) {
        return DatabaseType.ORACLE;
      }
      
      if (connStr.includes('postgresql') || connStr.includes('postgres')) {
        return DatabaseType.POSTGRES;
      }
      
      if (connStr.includes('mysql')) {
        return DatabaseType.MYSQL;
      }
      
      if (connStr.includes('sqlserver') || connStr.includes('mssql')) {
        return DatabaseType.MSSQL;
      }
    }
    
    // Default to Oracle if we can't determine
    this.logger.warn('Could not determine database type, defaulting to Oracle');
    return DatabaseType.ORACLE;
  }
}