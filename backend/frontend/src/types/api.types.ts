export interface AskRequestDto {
  username: string;
  password: string;
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  type: 'oracle' | 'postgres' | 'mysql' | 'mssql';
  prompt: string;
}

export interface AskResponseDto {
  result: string;
  executedQueries: string[];
  rawResults: any[];
  suggestedPrompts?: string[];
  errorInfo?: {
    message: string;
    code?: string;
    details?: string;
  };
}

export interface DatabaseInfo {
  name: string;
  version: string;
  currentUser: string;
  type: string;
}

export interface TableColumn {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  DATA_LENGTH?: number;
  DATA_PRECISION?: number;
  DATA_SCALE?: number;
  NULLABLE: 'Y' | 'N';
}

export interface TableDetails {
  owner: string;
  schema: string;
  tableName: string;
  rowCount: number;
  columns: TableColumn[];
  primaryKey: string[];
  sampleData: any[];
}

export interface TableRelationship {
  type: string;
  source: {
    schema: string;
    table: string;
    column: string;
  };
  target: {
    schema: string;
    table: string;
    column: string;
  };
}

export interface DatabaseMetadata {
  database: DatabaseInfo;
  tables: TableDetails[];
  relationships: TableRelationship[];
  tableCount: number;
  processedTables: number;
}