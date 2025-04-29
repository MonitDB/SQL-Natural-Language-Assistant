export type DatabaseType = "oracle" | "postgres" | "mysql" | "mssql";

export interface DatabaseConnection {
  username: string;
  password: string;
  connectionString: string;
  type: DatabaseType;
  database?: string; // Required for PostgreSQL, MySQL, and MSSQL
  port?: number; // Optional for Oracle, required for others
  schema?: string; // Optional, focus on a specific schema
}

export interface QueryRequest extends DatabaseConnection {
  prompt: string;
}

export interface ErrorInfo {
  error: boolean;
  message: string;
  type: string;
}

export interface QueryResponse {
  result: string;
  executedQueries: string[];
  rawResults: any[];
  suggestedPrompts: string[];
  errorInfo?: ErrorInfo;
}
