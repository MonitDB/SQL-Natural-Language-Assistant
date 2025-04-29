/**
 * Interface for database providers
 * This ensures consistent implementation across different database systems
 */
export interface DatabaseProvider {
  /**
   * Connect to a database
   * @param config Database connection configuration
   * @returns Database connection
   */
  connect(config: any): Promise<any>;
  
  /**
   * Execute a SQL query on the database connection
   * @param connection Database connection
   * @param sql SQL query to execute
   * @param timeout Query timeout in milliseconds
   * @returns Query results
   */
  executeQuery(connection: any, sql: string, timeout?: number): Promise<any[]>;
  
  /**
   * Close a database connection
   * @param connection Database connection to close
   */
  closeConnection(connection: any): Promise<void>;
  
  /**
   * Check if a SQL query is safe to execute
   * @param sql SQL query to validate
   * @returns True if the query is safe, false otherwise
   */
  isSafeSqlQuery(sql: string): boolean;
  
  /**
   * Get current database user
   * @param connection Database connection
   * @returns Current user name
   */
  getCurrentUser(connection: any): Promise<string>;
  
  /**
   * Get comprehensive database metadata
   * @param connection Database connection
   * @returns Database metadata including tables, columns, and relationships
   */
  getDatabaseMetadata(connection: any): Promise<any>;
}