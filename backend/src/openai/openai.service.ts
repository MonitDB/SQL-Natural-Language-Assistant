import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { safelySerializable, safeStringify } from '../utils/serialize.util';

@Injectable()
export class OpenaiService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(OpenaiService.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    if (!apiKey) {
      this.logger.error('OPENAI_API_KEY is missing. The service will not work correctly.');
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey
    });
    
    this.logger.log('OpenAI service initialized');
  }

  /**
   * Translate natural language prompt to SQL queries using detailed schema information
   */
  async translateToSql(
    prompt: string,
    databaseMetadata: any,
  ): Promise<string[]> {
    try {
      this.logger.log('Translating natural language to SQL with comprehensive schema analysis');
      
      // Check if there's a "no tables found" message in the metadata
      if (databaseMetadata && databaseMetadata.noTablesFound) {
        this.logger.warn('No database tables found for the connected user');
        
        // Create custom message for OpenAI to provide user guidance based on DB type
        const dbType = databaseMetadata.database?.type || 'database';
        const userGuidancePrompt = `
          The user has connected to a ${dbType} database but their account (${prompt.includes('username') ? prompt.split('username')[1].split(' ')[1] : 'current user'}) 
          does not have access to any tables or views. Generate a helpful message explaining:
          
          1. Why they might not see any tables (permissions, wrong schema, etc.)
          2. How to fix this issue (get proper permissions, connect as different user, specify schema names, etc.)
          3. Examples of how to refer to specific schemas in ${dbType} SQL if needed
          
          Original user query: "${prompt}"
          
          Database error: "${databaseMetadata.userAccessError}"
        `;
        
        // Call OpenAI for guidance instead of SQL
        const guidanceResponse = await this.openai.chat.completions.create({
          model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
          messages: [
            { 
              role: 'system', 
              content: `You are a ${dbType} database expert helping users troubleshoot connection and permission issues. Return your response as a JSON object with a "guidance" field containing your advice.` 
            },
            { role: 'user', content: userGuidancePrompt + " Return your response as a JSON object with a 'guidance' field." },
          ],
          response_format: { type: "json_object" }, // Request JSON format explicitly
          temperature: 0.7, // Higher temperature for more natural language response
        });
        
        const content = guidanceResponse.choices[0]?.message?.content?.trim();
        
        if (!content) {
          throw new Error('Could not generate SQL - no tables found that the user has access to');
        }
        
        let guidance = content;
        
        try {
          // Try to parse as JSON and extract guidance field
          const jsonResponse = JSON.parse(content);
          if (jsonResponse.guidance && typeof jsonResponse.guidance === 'string') {
            guidance = jsonResponse.guidance;
          }
        } catch (error) {
          // If parsing fails, use the raw content
          this.logger.warn(`Failed to parse guidance as JSON: ${error.message}`);
        }
        
        // Return special guidance query that will be handled by AskService
        return [`-- NO_TABLES_FOUND: ${guidance}`];
      }
      
      // Check if user is asking for table list - provide a standard query based on DB type
      if (
        prompt.toLowerCase().includes('list all tables') || 
        prompt.toLowerCase().includes('show all tables') || 
        prompt.toLowerCase().includes('show me all tables') ||
        prompt.toLowerCase().includes('all table names') ||
        prompt.toLowerCase().includes('enlist me all table') ||
        prompt.toLowerCase().includes('list the tables')
      ) {
        this.logger.log('User is requesting table list, using predefined query');
        
        // Different queries based on database type
        const dbType = databaseMetadata.database?.type?.toLowerCase() || 'oracle';
        
        if (dbType === 'oracle') {
          return [
            `SELECT owner, table_name FROM all_tables WHERE owner NOT IN ('SYS','SYSTEM') ORDER BY owner, table_name`,
            `SELECT table_name FROM user_tables ORDER BY table_name`
          ];
        } 
        else if (dbType === 'mssql' || dbType === 'sql server') {
          return [
            `SELECT s.name AS schema_name, t.name AS table_name
             FROM sys.tables t
             INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
             ORDER BY s.name, t.name`,
             
            `SELECT name AS table_name
             FROM sys.tables
             ORDER BY name`,
             
            `SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name
             FROM INFORMATION_SCHEMA.TABLES
             WHERE TABLE_TYPE = 'BASE TABLE'
             ORDER BY TABLE_SCHEMA, TABLE_NAME`
          ];
        }
        else if (dbType === 'postgresql' || dbType === 'postgres') {
          return [
            `SELECT table_schema, table_name 
             FROM information_schema.tables 
             WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
             ORDER BY table_schema, table_name`,
             
            `SELECT tablename AS table_name 
             FROM pg_tables 
             WHERE schemaname = current_schema()
             ORDER BY tablename`
          ];
        }
        else if (dbType === 'mysql') {
          return [
            `SHOW DATABASES`,
            `SHOW TABLES`
          ];
        }
        else {
          // Generic fallback query
          return [
            `SELECT table_name FROM information_schema.tables ORDER BY table_name`
          ];
        }
      }
      
      // Format schema information for OpenAI in a structured way
      let formattedSchema = this.formatSchemaForPrompt(databaseMetadata);
      
      // Create a detailed system message with schema information based on database type
      const dbType = databaseMetadata.database?.type || 'Oracle';
      
      // Define SQL syntax guidelines based on database type
      let dbSyntaxGuidelines = '';
      let rowLimitSyntax = '';
      
      if (dbType.toLowerCase() === 'oracle') {
        dbSyntaxGuidelines = `
IMPORTANT ORACLE SQL CONSTRAINTS:
- Oracle requires explicit joins with table aliases
- Oracle uses "dual" for queries without tables
- Oracle uses TRUNC(date) to get date without time
- Oracle concatenation uses || not + 
- Oracle date format is controlled with TO_CHAR(date, 'format')
- Oracle date intervals use INTERVAL syntax
- Oracle uses NVL(col, default) for NULL handling`;
        
        rowLimitSyntax = 'ROWNUM <= 100 or FETCH FIRST 100 ROWS ONLY';
      } 
      else if (dbType.toLowerCase() === 'mssql' || dbType.toLowerCase() === 'sql server') {
        dbSyntaxGuidelines = `
IMPORTANT SQL SERVER CONSTRAINTS:
- SQL Server uses TOP for limiting results
- SQL Server uses ISNULL() for NULL handling
- SQL Server uses + for string concatenation
- SQL Server date functions include DATEPART(), DATEDIFF(), CONVERT()
- SQL Server supports multiple JOIN types including CROSS APPLY
- SQL Server uses square brackets [table_name] for object identifiers with spaces or special characters`;

        rowLimitSyntax = 'TOP 100';
      }
      else if (dbType.toLowerCase() === 'postgresql' || dbType.toLowerCase() === 'postgres') {
        dbSyntaxGuidelines = `
IMPORTANT POSTGRESQL CONSTRAINTS:
- PostgreSQL uses LIMIT for restricting result counts
- PostgreSQL uses || for string concatenation
- PostgreSQL uses COALESCE() for NULL handling
- PostgreSQL has rich JSON support with operators -> and ->>
- PostgreSQL uses double quotes for object identifiers with mixed case or special characters
- PostgreSQL uses AGE() and EXTRACT() for date manipulation
- IMPORTANT: PostgreSQL does NOT have all_tables or user_tables views like Oracle
- For table listing, use pg_tables: SELECT tablename FROM pg_tables WHERE schemaname='public'
- For schema information, use information_schema.tables and information_schema.columns
- Always use current_schema() function to reference the current schema when needed`;

        rowLimitSyntax = 'LIMIT 100';
      }
      else if (dbType.toLowerCase() === 'mysql') {
        dbSyntaxGuidelines = `
IMPORTANT MYSQL CONSTRAINTS:
- MySQL uses LIMIT for restricting result counts
- MySQL uses CONCAT() for string concatenation
- MySQL uses IFNULL() for NULL handling
- MySQL uses backticks \`table_name\` for object identifiers with spaces or reserved words
- MySQL date functions include DATE_FORMAT(), DATEDIFF(), and DATE_ADD()
- MySQL supports multiple JOIN types`;

        rowLimitSyntax = 'LIMIT 100';
      }
      
      const systemMessage = `
You are an expert ${dbType} SQL database analyst who translates natural language questions into precise SQL queries.
You have access to the following database schema information:

${formattedSchema}

GUIDELINES FOR GENERATING SQL QUERIES:
1. Analyze the database schema carefully to identify relevant tables and their relationships.
2. Generate valid ${dbType} SQL based on the provided schema information.
3. Use proper table aliases when joining multiple tables.
4. Include column names with proper table prefixes in joins.
5. Limit results to reasonable sizes with ${rowLimitSyntax} clauses.
6. DO NOT generate destructive queries (INSERT, UPDATE, DELETE, DROP, etc.)
7. For each query, include all relevant columns that would help answer the question.
8. Return an array of SQL queries without markdown formatting or explanations.
9. Format column names in the result for readability, using "AS" for column aliases.
10. Properly join tables using foreign key relationships from the schema information.
11. For broad requests, focus on tables that have actual data (with row counts) as indicated in the schema.
12. DO NOT include semicolons at the end of SQL queries as they may cause issues with execution.

${dbSyntaxGuidelines}
`;

      // Create a detailed message with the user's prompt
      const userMessage = `
Generate ${dbType} SQL queries to answer the following question:

${prompt}

Based on the database schema provided in the system message, analyze:
1. Which tables are relevant to this question?
2. What columns contain the needed information?
3. Are any table joins required?
4. What filters should be applied?

Return the SQL queries as a JSON object with a 'queries' array. Format like: {"queries": ["SELECT * FROM table1", "SELECT * FROM table2"]}
Do not include semicolons at the end of the queries.
`;
      
      // Make the API call with the detailed schema information
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        response_format: { type: "json_object" }, // Request JSON format explicitly
        temperature: 0.2, // Lower temperature for more predictable SQL generation
      });
      
      // Extract SQL queries from response
      const content = completion.choices[0].message.content.trim();
      this.logger.log('Received OpenAI response, extracting SQL queries');
      
      // Process the response to extract SQL queries
      // First, try to parse as JSON
      try {
        const jsonResponse = JSON.parse(content);
        
        // Check if the response has a "queries" array
        if (jsonResponse.queries && Array.isArray(jsonResponse.queries)) {
          const queries = jsonResponse.queries
            .filter(q => q && typeof q === 'string' && q.trim().length > 0)
            .map(q => this.cleanAndValidateQuery(q));
            
          this.logger.log(`Generated ${queries.length} SQL queries from JSON response`);
          return queries;
        }
        
        // If it doesn't have a "queries" array but is itself an array
        if (Array.isArray(jsonResponse)) {
          const queries = jsonResponse
            .filter(q => q && typeof q === 'string' && q.trim().length > 0)
            .map(q => this.cleanAndValidateQuery(q));
            
          this.logger.log(`Generated ${queries.length} SQL queries from JSON array`);
          return queries;
        }
        
        // If it's an object with string properties, extract those
        const potentialQueries = [];
        for (const key in jsonResponse) {
          if (typeof jsonResponse[key] === 'string' && jsonResponse[key].trim().toUpperCase().includes('SELECT')) {
            potentialQueries.push(jsonResponse[key]);
          }
        }
        
        if (potentialQueries.length > 0) {
          const queries = potentialQueries.map(q => this.cleanAndValidateQuery(q));
          this.logger.log(`Generated ${queries.length} SQL queries from JSON object properties`);
          return queries;
        }
      } catch (e) {
        // Not valid JSON, fallback to text processing
        this.logger.warn(`Failed to parse response as JSON: ${e.message}`);
      }
      
      // Fallback to text extraction if JSON parsing fails
      // Look for SQL statements in the content
      const sqlRegex = /SELECT\s+[\s\S]+?(?=SELECT|$)/gi;
      const matches = content.match(sqlRegex);
      
      if (matches && matches.length > 0) {
        const queries = matches
          .map(match => match.trim())
          .filter(q => q.length > 0)
          .map(q => this.cleanAndValidateQuery(q));
          
        this.logger.log(`Generated ${queries.length} SQL queries from regex extraction`);
        return queries;
      }
      
      // If no queries found, use a database-specific fallback
      this.logger.warn('Could not extract SQL queries from response, using fallback queries');
      
      // Different fallback queries based on database type
      const fallbackDbType = databaseMetadata.database?.type?.toLowerCase() || 'oracle';
      
      if (fallbackDbType === 'oracle') {
        return [
          `SELECT owner, table_name FROM all_tables WHERE owner NOT IN ('SYS','SYSTEM') ORDER BY owner, table_name`,
          `SELECT table_name FROM user_tables ORDER BY table_name`
        ];
      } 
      else if (fallbackDbType === 'mssql' || fallbackDbType === 'sql server') {
        return [
          // First query: try INFORMATION_SCHEMA which is ANSI standard and widely supported
          `SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name
           FROM INFORMATION_SCHEMA.TABLES
           WHERE TABLE_TYPE = 'BASE TABLE'
           ORDER BY TABLE_SCHEMA, TABLE_NAME`,
           
          // Backup query to get database name if the first query fails
          `SELECT DB_NAME() AS database_name`,
           
          // SQL Server native catalog query if INFORMATION_SCHEMA doesn't work
          `SELECT SCHEMA_NAME(schema_id) AS schema_name, name AS table_name
           FROM sys.tables
           ORDER BY schema_name, name`
        ];
      }
      else if (fallbackDbType === 'postgresql') {
        return [
          `SELECT table_schema, table_name 
           FROM information_schema.tables 
           WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
           ORDER BY table_schema, table_name`,
           
          `SELECT tablename AS table_name 
           FROM pg_tables 
           WHERE schemaname = current_schema()
           ORDER BY tablename`
        ];
      }
      else if (fallbackDbType === 'mysql') {
        return [
          `SHOW DATABASES`,
          `SHOW TABLES`
        ];
      }
      else {
        // Generic fallback query
        return [
          `SELECT table_name FROM information_schema.tables ORDER BY table_name`
        ];
      }
    } catch (error) {
      this.logger.error(`Error translating to SQL: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Format schema information into a structured prompt for OpenAI
   */
  private formatSchemaForPrompt(schema: any): string {
    try {
      // Apply safe serialization to the schema to avoid circular references
      const safeSchema = safelySerializable(schema);
      
      let formatted = '';
      
      // Add database overview - ultra compact format
      if (safeSchema.database) {
        formatted += `DB: ${safeSchema.database.type || 'Oracle'} | `;
        formatted += `Name: ${safeSchema.database.name || 'Unknown'} | `;
        formatted += `User: ${safeSchema.database.currentUser || 'Unknown'}\n\n`;
      }
      
      // Ultra-compact table count information
      formatted += `Tables: ${safeSchema.processedTables || 0} of ${safeSchema.tableCount || 'Unknown'} analyzed\n\n`;
      
      if (safeSchema.tables && Array.isArray(safeSchema.tables)) {
        // Sort tables to prioritize those that appear in relationships and have data
        const tables = [...safeSchema.tables].sort((a, b) => {
          // First by relationship count (if we can estimate it)
          const aHasRels = safeSchema.relationships ? safeSchema.relationships.filter(r => 
            (r.source.table === a.tableName && r.source.schema === a.owner) || 
            (r.target.table === a.tableName && r.target.schema === a.owner)
          ).length : 0;
          
          const bHasRels = safeSchema.relationships ? safeSchema.relationships.filter(r => 
            (r.source.table === b.tableName && r.source.schema === b.owner) || 
            (r.target.table === b.tableName && r.target.schema === b.owner)
          ).length : 0;
          
          if (aHasRels > bHasRels) return -1;
          if (aHasRels < bHasRels) return 1;
          
          // Then by having sample data
          const aHasData = a.sampleData && a.sampleData.length > 0;
          const bHasData = b.sampleData && b.sampleData.length > 0;
          
          if (aHasData && !bHasData) return -1;
          if (!aHasData && bHasData) return 1;
          
          // Otherwise alphabetical
          return (a.tableName || '').localeCompare(b.tableName || '');
        });
        
        // Ultra-compact table definitions
        for (const table of tables) {
          if (!table.tableName) continue;
          
          // Table header with schema.table format
          formatted += `T: ${table.owner || 'dbo'}.${table.tableName}\n`;
          
          // Primary keys in compact format
          if (table.primaryKey && table.primaryKey.length > 0) {
            formatted += `  PK: ${table.primaryKey.join(', ')}\n`;
          }
          
          // Add columns in ultra-compact form
          if (table.columns && Array.isArray(table.columns)) {
            // Sort columns to prioritize primary keys and ID columns first
            const sortedColumns = [...table.columns].sort((a, b) => {
              const aIsPK = (table.primaryKey || []).includes(a.COLUMN_NAME);
              const bIsPK = (table.primaryKey || []).includes(b.COLUMN_NAME);
              
              if (aIsPK && !bIsPK) return -1;
              if (!aIsPK && bIsPK) return 1;
              
              const aIsId = (a.COLUMN_NAME || '').toLowerCase().includes('id');
              const bIsId = (b.COLUMN_NAME || '').toLowerCase().includes('id');
              
              if (aIsId && !bIsId) return -1;
              if (!aIsId && bIsId) return 1;
              
              return 0;
            });
            
            // Group columns in compact multi-column rows to save space
            let columnGroups = [];
            let currentGroup = [];
            
            for (const col of sortedColumns) {
              currentGroup.push(col);
              
              // Start a new group every 4 columns
              if (currentGroup.length >= 4) {
                columnGroups.push([...currentGroup]);
                currentGroup = [];
              }
            }
            
            // Add remaining columns
            if (currentGroup.length > 0) {
              columnGroups.push(currentGroup);
            }
            
            // Output compact column groups
            for (const group of columnGroups) {
              const colLine = group.map(col => {
                const isPK = (table.primaryKey || []).includes(col.COLUMN_NAME) ? "!" : "";
                const nullable = col.NULLABLE === 'Y' ? "?" : "";
                return `${col.COLUMN_NAME}${isPK}${nullable}:${col.DATA_TYPE}`;
              }).join(", ");
              
              formatted += `  ${colLine}\n`;
            }
          }
          
          // Add very limited sample data - just 1 row with key columns
          if (table.sampleData && Array.isArray(table.sampleData) && table.sampleData.length > 0) {
            const row = table.sampleData[0];
            
            // Prioritize primary key and columns with 'id', 'name', 'code'
            let importantColumns = [];
            
            // Add primary key columns first
            if (table.primaryKey && table.primaryKey.length > 0) {
              importantColumns = [...table.primaryKey];
            }
            
            // Add a few important non-PK columns if we have space
            if (importantColumns.length < 3) {
              // Look for name-like columns
              const nameColumns = Object.keys(row).filter(k => 
                !importantColumns.includes(k) && 
                (k.toLowerCase().includes('name') || 
                 k.toLowerCase().includes('title') ||
                 k.toLowerCase().includes('desc'))
              );
              
              // Add up to our limit of 3
              for (let i = 0; i < nameColumns.length && importantColumns.length < 3; i++) {
                importantColumns.push(nameColumns[i]);
              }
              
              // If still under 3, add other columns
              if (importantColumns.length < 3) {
                const remainingColumns = Object.keys(row).filter(k => !importantColumns.includes(k));
                for (let i = 0; i < remainingColumns.length && importantColumns.length < 3; i++) {
                  importantColumns.push(remainingColumns[i]);
                }
              }
            }
            
            // Format a compact sample
            const sampleValues = importantColumns.map(col => {
              const val = row[col];
              const displayVal = val === null ? 'NULL' : 
                      typeof val === 'string' ? (val.length > 15 ? val.substring(0, 12) + '...' : val) : 
                      String(val);
              return `${col}=${displayVal}`;
            }).join(', ');
            
            if (sampleValues) {
              formatted += `  Sample: ${sampleValues}\n`;
            }
          }
          
          formatted += '\n';
        }
      }
      
      // Add relationship information in ultra-compact form
      if (safeSchema.relationships && Array.isArray(safeSchema.relationships) && safeSchema.relationships.length > 0) {
        // Group relationships by source table
        const relationshipsBySource = {};
        
        for (const rel of safeSchema.relationships) {
          const sourceKey = `${rel.source.schema}.${rel.source.table}`;
          if (!relationshipsBySource[sourceKey]) {
            relationshipsBySource[sourceKey] = [];
          }
          relationshipsBySource[sourceKey].push(rel);
        }
        
        // Output compressed relationship data
        formatted += 'RELATIONSHIPS:\n';
        
        for (const sourceKey in relationshipsBySource) {
          const relations = relationshipsBySource[sourceKey];
          const [sourceSchema, sourceTable] = sourceKey.split('.');
          
          // Group by target table to further compress
          const targetGroups = {};
          
          for (const rel of relations) {
            const targetKey = `${rel.target.schema}.${rel.target.table}`;
            if (!targetGroups[targetKey]) {
              targetGroups[targetKey] = [];
            }
            targetGroups[targetKey].push(`${rel.source.column}->${rel.target.column}`);
          }
          
          // Output one line per source table
          formatted += `* ${sourceTable} → `;
          
          const targets = [];
          for (const targetKey in targetGroups) {
            const [targetSchema, targetTable] = targetKey.split('.');
            const columnMappings = targetGroups[targetKey].join(',');
            targets.push(`${targetTable}(${columnMappings})`);
          }
          
          formatted += targets.join(', ') + '\n';
        }
      }
      
      return formatted;
    } catch (error) {
      this.logger.error(`Error formatting schema for prompt: ${error.message}`);
      return 'Error: Could not format schema information.';
    }
  }
  
  /**
   * Clean and validate an SQL query
   */
  private cleanAndValidateQuery(query: string): string {
    // Remove markdown code backticks
    let cleaned = query.replace(/```sql|```/g, '').trim();
    
    // Remove trailing semicolons (Oracle doesn't want them)
    cleaned = cleaned.replace(/;+$/, '');
    
    // Replace any double spaces with single spaces
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Remove any EXECUTE or EXEC statements
    cleaned = cleaned.replace(/^(EXECUTE|EXEC)\s+/i, '');
    
    // Handle "SHOW TABLES" command for SQL Server which doesn't support this syntax
    if (cleaned.toUpperCase() === 'SHOW TABLES') {
      this.logger.warn('Detected "SHOW TABLES" command, converting to database-specific query');
      
      // Default to INFORMATION_SCHEMA which is more widely supported
      return `SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name 
              FROM INFORMATION_SCHEMA.TABLES 
              WHERE TABLE_TYPE = 'BASE TABLE' 
              ORDER BY TABLE_SCHEMA, TABLE_NAME`;
    }
    
    // Check if it's a SELECT query without FROM and fix it with a database-appropriate query
    if (cleaned.toUpperCase().includes('SELECT') && 
        !cleaned.toUpperCase().includes('FROM')) {
      this.logger.warn('Detected incomplete SELECT query without FROM clause, using safer alternative');
      
      // Different queries based on identified database type in query content
      if (cleaned.toLowerCase().includes('postgres') || cleaned.toLowerCase().includes('pg_')) {
        return `SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`;
      }
      else if (cleaned.toLowerCase().includes('sql server') || cleaned.toLowerCase().includes('mssql')) {
        return `SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_TYPE = 'BASE TABLE'`;
      }
      else if (cleaned.toLowerCase().includes('mysql')) {
        return `SHOW TABLES`;
      }
      else if (cleaned.toLowerCase().includes('postgre')) {
        return `SELECT tablename AS table_name FROM pg_tables WHERE schemaname = 'public'`;
      }
      else {
        // Default to more generic ANSI SQL syntax (works in most databases)
        return `SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE'`;
      }
    }
    
    // Add specific handling for "show all data" type queries
    if (/SELECT\s+\*\s+FROM\s+\w+/i.test(cleaned) && 
        !cleaned.toUpperCase().includes('WHERE') && 
        !cleaned.toUpperCase().includes('ROWNUM') && 
        !cleaned.toUpperCase().includes('FETCH FIRST') &&
        !cleaned.toUpperCase().includes('LIMIT') &&
        !cleaned.toUpperCase().includes('TOP')) {
      
      // Add database-specific row limiting to prevent massive result sets
      this.logger.warn('Adding row limiting to broad query');
      
      // Apply the appropriate limiting syntax based on the SQL dialect in the query
      if (cleaned.toLowerCase().includes('postgres') || cleaned.toLowerCase().includes('pg_')) {
        cleaned += ' LIMIT 100';
      }
      else if (cleaned.toLowerCase().includes('mysql')) {
        cleaned += ' LIMIT 100';
      }
      else if (cleaned.toLowerCase().includes('sql server') || cleaned.toLowerCase().includes('sys.')) {
        // For SQL Server, we need to insert TOP into the query
        cleaned = cleaned.replace(/SELECT\s+/i, 'SELECT TOP 100 ');
      }
      else if (cleaned.toLowerCase().includes('postgre') || cleaned.toLowerCase().includes('pg_')) {
        // For PostgreSQL, use LIMIT syntax
        cleaned += ' LIMIT 100';
      }
      else {
        // Default to Oracle syntax for Oracle databases
        cleaned += ' WHERE ROWNUM <= 100';
      }
    }
    
    return cleaned;
  }

  /**
   * Generate summary of database query results
   */
  async generateSummary(
    prompt: string,
    executedQueries: string[],
    queryResults: any[],
  ): Promise<string> {
    try {
      this.logger.log('Generating summary of query results');
      
      // Calculate approximate token count for results before sending to OpenAI
      let totalTokens = 0;
      const MAX_TOKENS_PER_QUERY = 5000; // Conservative estimate to avoid rate limits
      const MAX_TOTAL_TOKENS = 25000; // Leave room for model response
      
      // Format query results for the prompt, limiting token count
      const formattedResults = [];
      
      for (let i = 0; i < executedQueries.length; i++) {
        const query = executedQueries[i];
        const result = queryResults[i] || [];
        
        // Create a safe serialized version of the result
        const safeResult = safelySerializable(result);
        
        // Estimate tokens (rough approximation: 1 token ~= 4 chars)
        const resultJson = safeStringify(safeResult);
        const estimatedTokens = resultJson.length / 4;
        
        // If this single result is too large, limit its size
        let processedResult = safeResult;
        if (estimatedTokens > MAX_TOKENS_PER_QUERY) {
          this.logger.warn(`Query ${i+1} results too large (${Math.round(estimatedTokens)} tokens), truncating`);
          
          if (Array.isArray(safeResult)) {
            // For arrays, take fewer items
            const limitedRows = safeResult.slice(0, Math.min(5, safeResult.length));
            processedResult = limitedRows;
            this.logger.warn(`Limited array to ${limitedRows.length} items`);
          } else {
            // For objects, create a summary
            processedResult = { 
              _limited: true, 
              _original_size: JSON.stringify(safeResult).length,
              _message: "Result too large for summary generation" 
            };
          }
        }
        
        // Add to formatted results if we have room
        const formattedQuery = `
          Query: ${query}
          Results: ${safeStringify(processedResult)}
        `;
        
        // Estimate tokens for this formatted query
        const queryTokens = formattedQuery.length / 4;
        
        if (totalTokens + queryTokens <= MAX_TOTAL_TOKENS) {
          formattedResults.push(formattedQuery);
          totalTokens += queryTokens;
        } else {
          this.logger.warn(`Omitting query ${i+1} results to avoid token limit`);
          // Add a placeholder to show that we omitted this query
          formattedResults.push(`
            Query: ${query}
            Results: [Results omitted due to token limitations]
          `);
          // Break after adding this placeholder, as we're already at the limit
          break;
        }
      }
      
      const queriesAndResults = formattedResults.join('\n\n');
      
      // Create system message
      const systemMessage = `
        You are a data analyst explaining database query results in a clear, concise manner.
        Provide a human-readable summary of the database query results that answers the original question.
        Focus on insights from the data, mentioning counts, patterns, or notable findings.
        Keep your explanation concise, around 3-5 sentences.
        Return your response as a JSON object with a "summary" field containing your explanation.
      `;
      
      // Create user message
      const userMessage = `
        Original question: ${prompt}
        
        Executed Queries and Results:
        ${queriesAndResults}
        
        Please provide a clear summary of these results that answers the original question.
        Return your response as a JSON object with a "summary" field.
      `;
      
      // Call OpenAI API to generate summary
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: "json_object" }, // Request JSON format explicitly
        temperature: 0.7, // Higher temperature for more natural language summaries
      });
      
      const content = response.choices[0]?.message?.content?.trim();
      
      if (!content) {
        this.logger.warn('OpenAI could not generate a summary');
        return 'No summary could be generated from the query results.';
      }
      
      try {
        // Parse JSON response
        const jsonResponse = JSON.parse(content);
        
        // Check if the response has a "summary" field
        if (jsonResponse.summary && typeof jsonResponse.summary === 'string') {
          return jsonResponse.summary;
        }
        
        // If not, look for any string field that might contain the summary
        for (const key in jsonResponse) {
          if (typeof jsonResponse[key] === 'string' && jsonResponse[key].length > 10) {
            return jsonResponse[key];
          }
        }
        
        // Fallback to the whole content if we can't extract a specific field
        return content;
      } catch (error) {
        this.logger.warn(`Failed to parse summary as JSON: ${error.message}`);
        // Fallback to returning the raw content
        return content;
      }
    } catch (error) {
      this.logger.error(`Error generating summary: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generate suggested follow-up prompts based on current query and results
   */
  async generatePromptSuggestions(
    prompt: string,
    executedQueries: string[],
    queryResults: any[],
    databaseMetadata: any,
  ): Promise<string[]> {
    try {
      this.logger.log('Generating suggested follow-up prompts');
      
      // Format query results for the prompt (limited to save token usage)
      const queriesAndResults = executedQueries.map((query, index) => {
        const result = queryResults[index] || [];
        // Limit the number of results to include in the prompt
        const limitedResults = Array.isArray(result) ? result.slice(0, 3) : result;
        // Use safeStringify to handle any circular references
        return `
          Query: ${query}
          Sample Results: ${safeStringify(safelySerializable(limitedResults))}
        `;
      }).join('\n\n');
      
      // Format schema info in a compact way
      let schemaInfo = '';
      
      // Apply safe serialization to database metadata to avoid circular references
      const safeMetadata = safelySerializable(databaseMetadata);
      
      if (safeMetadata && safeMetadata.tables && safeMetadata.tables.length > 0) {
        const tableInfo = safeMetadata.tables.map(table => {
          const tableName = `${table.owner}.${table.tableName}`;
          // Get a subset of columns to save tokens
          const sampleColumns = table.columns ? 
            table.columns.slice(0, 5).map(col => col.COLUMN_NAME || col.column_name).join(', ') : 
            'Columns info not available';
          
          return `${tableName} (Sample columns: ${sampleColumns})`;
        }).join('\n');
        
        schemaInfo = `
          Available Database Tables:
          ${tableInfo}
        `;
      } else {
        schemaInfo = 'Schema information not available';
      }
      
      // Create system message with appropriate database type
      const dbType = databaseMetadata?.database?.type || 'database';
      const systemMessage = `
        You are an AI assistant helping users explore a ${dbType} database.
        Based on the user's question and the query results, generate 3 suggested follow-up prompts.
        These should be natural language questions (not SQL) that would help the user continue their database exploration.
        The suggestions should be diverse and cover different aspects of the data they might want to explore next.
      `;
      
      // Create user message
      const userMessage = `
        Original question: ${prompt}
        
        ${queriesAndResults}
        
        ${schemaInfo}
        
        Generate exactly 3 suggested follow-up prompts that would be logical and helpful next questions for the user.
        The questions should be diverse, interesting, and relevant to what they've already explored.
        Return your suggestions in a JSON object with a "suggestions" field containing an array of 3 strings.
      `;
      
      // Call OpenAI API to generate suggestions
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: "json_object" }, // Request JSON format explicitly
        temperature: 0.8, // Higher temperature for creative suggestions
      });
      
      const content = response.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }
      
      try {
        // Parse JSON response
        const parsedResponse = JSON.parse(content);
        
        if (parsedResponse.suggestions && Array.isArray(parsedResponse.suggestions)) {
          return parsedResponse.suggestions.slice(0, 3); // Ensure we only return at most 3 suggestions
        } else {
          // If the format is unexpected but we have something, try to extract suggestions
          const fallbackSuggestions = Object.values(parsedResponse)
            .filter(value => typeof value === 'string')
            .slice(0, 3);
            
          if (fallbackSuggestions.length > 0) {
            return fallbackSuggestions;
          }
          
          throw new Error('Unexpected JSON response format');
        }
      } catch (jsonError) {
        this.logger.error(`Error parsing suggestions JSON: ${jsonError.message}`);
        
        // Default fallback suggestions
        return [
          "Show me the main tables in this database and their relationships",
          "What kind of data is stored in the largest tables?",
          "Can you find any interesting patterns or trends in this data?"
        ];
      }
    } catch (error) {
      this.logger.error(`Error generating prompt suggestions: ${error.message}`);
      
      // Generic fallback suggestions
      return [
        "What other tables are available in this database?",
        "Show me sample data from the main tables",
        "Can you explain the schema structure of this database?"
      ];
    }
  }
}