/**
 * Common interface for all database configurations
 */
export interface DatabaseConfig {
  type: DatabaseType;
  username: string;
  password: string;
  host: string;
  port: number;
  database?: string;  // Optional for Oracle which uses connectionString
  connectionString?: string; // For Oracle format
}

/**
 * Supported database types
 */
export enum DatabaseType {
  ORACLE = 'oracle',
  POSTGRES = 'postgres',
  MYSQL = 'mysql',
  MSSQL = 'mssql'
}