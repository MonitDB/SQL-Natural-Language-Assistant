# Natural Language to SQL Query API

This API allows users to query databases using natural language. It uses the power of OpenAI's models to translate natural language queries into SQL, executes them safely on multiple database types, and provides comprehensive results.

## Recent Improvements

- **Schema Selection Parameter**: Added ability to specify a particular schema/entity to scan when working with large databases. This focuses the analysis on a single schema, analyzing more tables within it (100 vs 30) for better results.
- **Multi-Database Support**: Added support for PostgreSQL, MySQL, and Microsoft SQL Server in addition to Oracle.
- **Database Factory Architecture**: Implemented a modular provider-based architecture using the Strategy pattern to support multiple database types.
- **Smart Schema Discovery**: Automatically detects and prioritizes schemas based on the user's own schema, commonly used application schemas, and schemas with manageable numbers of tables.
- **Suggested Follow-up Prompts**: Each query response now includes contextually relevant suggested prompts to help users continue exploring their database.
- **Schema-Agnostic Implementation**: Completely redesigned to work with any database schema, not just specific schemas like HR.
- **Enhanced Error Handling**: Improved error diagnosis and recovery for database connection issues.
- **Performance Tuning**: Optimized resource-efficient database metadata collection with sampling to prevent timeouts with large databases.

## Features

- Natural language to SQL translation using OpenAI (gpt-4o model)
- **Multi-Database Support**: Oracle, PostgreSQL, MySQL, and Microsoft SQL Server
- Smart schema discovery with prioritized schema scanning for all database types
- Safe execution of queries (prevents destructive operations)
- Suggested follow-up prompts for continued database exploration
- Comprehensive error handling and diagnostics
- Support for various connection formats for each database type
- Progressive query timeouts to prevent hanging connections
- Resource-efficient sampling for large databases
- Human-readable summaries of query results
- JSON-formatted responses for better integration

## Running the Project Locally

### Prerequisites

1. Node.js 14+ installed
2. Database client prerequisites:
   - **Oracle**: Oracle Instant Client installed on your machine
     - Download from [Oracle's website](https://www.oracle.com/database/technologies/instant-client/downloads.html)
     - Follow installation instructions for your operating system
   - **PostgreSQL, MySQL, MS SQL Server**: No additional client installation required; native Node.js drivers are used
3. OpenAI API Key

### Installation Steps

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd oracle-nl-query-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   # Linux/macOS
   export OPENAI_API_KEY=your_openai_api_key

   # Windows (Command Prompt)
   set OPENAI_API_KEY=your_openai_api_key

   # Windows (PowerShell)
   $env:OPENAI_API_KEY="your_openai_api_key"
   ```

4. Build the application:
   ```bash
   npx @nestjs/cli build
   ```

5. Start the application:
   ```bash
   # Using NestJS directly
   node dist/main.js

   # Alternative: Using the Python wrapper (requires Flask)
   python main.py
   ```

6. Access the application:
   - API endpoints will be available at http://localhost:3005
   - Swagger documentation available at http://localhost:3005/api
   - If using Python wrapper, a web interface is available at http://localhost:5000

### Testing the API

You can test the API using curl:

```bash
# Oracle example
curl -X POST http://localhost:3005/ask \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_oracle_username",
    "password": "your_oracle_password",
    "connectionString": "host:port/service_name",
    "type": "oracle",
    "prompt": "List all tables"
  }'

# PostgreSQL example
curl -X POST http://localhost:3005/ask \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_postgres_username",
    "password": "your_postgres_password",
    "connectionString": "host",
    "port": 5432,
    "type": "postgres",
    "database": "your_postgres_database",
    "prompt": "List all tables"
  }'
```

Or use the Swagger UI at http://localhost:3005/api for interactive testing.

## API Endpoints

### `/ask` (POST)

Translates a natural language prompt to SQL, executes it on a database, and returns the results.

**Request Body:**

```json
{
  "username": "your_database_username",
  "password": "your_database_password",
  "connectionString": "host:port/service_name_or_database",
  "port": 1521,
  "type": "oracle", // Optional, can be "oracle", "postgres", "mysql", or "mssql"
  "database": "your_database_name", // Required for PostgreSQL, MySQL, and MSSQL
  "schema": "specific_schema_name", // Optional, focus on a specific schema/entity for better results
  "prompt": "Your natural language query"
}
```

**Response:**

```json
{
  "result": "Human-readable summary of the query results",
  "executedQueries": ["SQL query that was executed", "..."],
  "rawResults": [...],
  "suggestedPrompts": [
    "Example follow-up question 1",
    "Example follow-up question 2",
    "Example follow-up question 3"
  ]
}
```

#### Example Queries

The API works particularly well with natural language queries about the HR schema. Here are some examples:

```
"What regions are defined in the HR.REGIONS table?"
"List the countries in Europe"
"Show me employees in the IT department and their managers"
"What is the average salary by department, and which department has the highest average salary?"
"How many employees are there in each department?"
"Which employee has the highest salary?"
```

#### Using the Schema Parameter

When working with large databases, you can use the `schema` parameter to focus the analysis on a specific schema/entity:

**Oracle Example (using schema="HR"):**
```json
{
  "username": "your_username",
  "password": "your_password",
  "connectionString": "host:port/service_name",
  "type": "oracle",
  "schema": "HR",
  "prompt": "List all employees with their departments"
}
```

**SQL Server Example (using schema="dbo"):**
```json
{
  "username": "your_username",
  "password": "your_password",
  "connectionString": "server_name",
  "port": 1433,
  "database": "AdventureWorks",
  "type": "mssql",
  "schema": "dbo",
  "prompt": "Show me all customers with their orders"
}
```

**PostgreSQL Example (using schema="public"):**
```json
{
  "username": "your_username",
  "password": "your_password",
  "connectionString": "host",
  "port": 5432,
  "database": "postgres",
  "type": "postgres",
  "schema": "public",
  "prompt": "List all users with their roles"
}
```

When you provide a schema parameter, the system analyzes more tables within that schema (8 tables instead of 3), providing better context for your natural language queries.

### `/test/oracle` (GET)

Tests the Oracle database connection using the multi-database architecture.

### `/ask/test-suggestions` (GET)

Tests the suggested prompts feature without requiring a database connection. Returns a sample response with suggested follow-up prompts based on mock database data.

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key
- `PORT`: (Optional) Port for the NestJS server (default: 3005)

## Connection String Formats

### Oracle

The API supports multiple Oracle connection string formats:

1. **EZ Connect** (Recommended): `host:port/service_name`
2. **TNS Connect Descriptor**: `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=host)(PORT=port))(CONNECT_DATA=(SERVICE_NAME=service_name)))`
3. **SID-based**: `host:port:SID`

### PostgreSQL

For PostgreSQL, the connection string is the hostname, and you must specify the database name separately:

```json
{
  "connectionString": "hostname",
  "port": 5432,
  "database": "database_name",
  "type": "postgres"
}
```

### MySQL

For MySQL, the connection string is the hostname, with the database name specified separately:

```json
{
  "connectionString": "hostname",
  "port": 3306,
  "database": "database_name",
  "type": "mysql"
}
```

### Microsoft SQL Server

For SQL Server, the connection string is the server name, with the database name specified separately:

```json
{
  "connectionString": "server_name",
  "port": 1433,
  "database": "database_name",
  "type": "mssql"
}
```

## Performance Optimizations

The API includes the following performance optimizations:

- **Schema Parameter for Targeted Analysis**: You can now specify a particular schema to focus on, which increases the number of tables analyzed in that schema (100 tables versus the default 30 tables per schema). This is particularly useful for large databases where you know which schema contains the relevant tables.

- **Schema-Focused Scanning**: Instead of scanning the entire database metadata (which can be slow on large databases), the system uses an optimized approach that targets specific schemas detected in the database. For Oracle databases with the standard HR schema, the API automatically detects and focuses on this schema.

- **Database-Specific Schema Behavior**: The schema parameter is intelligently handled for each database type:
  - In Oracle, schemas correspond to owners/users (HR, SCOTT, SYS)
  - In SQL Server, schemas are explicit objects (dbo, APPLICATION, HISTORIC)
  - In PostgreSQL, common schemas include public and custom schema names
  - In MySQL, schemas typically match database names

- **Tiered Metadata Collection**: For larger databases, the system uses a tiered approach to metadata collection, first gathering basic table information before selectively collecting detailed metadata only for tables likely relevant to the query.

- **Query Timeouts**: All database operations have configurable timeouts to prevent hanging connections.

- **Response Size Limits**: Result sets are limited to prevent excessive memory usage and data transfer.

## Limitations

- Destructive SQL operations (DELETE, DROP, etc.) are not permitted
- Queries have a timeout limit (default: 30 seconds for complex queries)
- Result sets are limited to 100 rows to prevent memory issues
- OpenAI API key is required for natural language processing

## Error Handling

The API includes enhanced error diagnostics for common database connectivity issues across all supported database types:

### Common Error Diagnostics (All Database Types)
- Invalid credentials
- Network connectivity problems
- Server not running
- Insufficient permissions
- Query syntax errors
- Timeout issues

### Oracle-Specific Errors
- Incorrect service name or SID
- Oracle client configuration issues
- TNS resolution problems

### PostgreSQL-Specific Errors
- Database name not found
- Schema permission issues
- SSL connection problems

### MySQL-Specific Errors
- Database selection errors
- Authentication plugin compatibility

### SQL Server-Specific Errors
- Windows authentication issues
- Database instance name resolution problems

## Troubleshooting

### Oracle Instant Client Issues

If you encounter errors related to the Oracle client:

1. Ensure Oracle Instant Client is properly installed
2. Set environment variables properly:
   ```bash
   # Linux
   export LD_LIBRARY_PATH=/path/to/instantclient:$LD_LIBRARY_PATH
   
   # macOS
   export DYLD_LIBRARY_PATH=/path/to/instantclient:$DYLD_LIBRARY_PATH
   
   # Windows
   set PATH=C:\path\to\instantclient;%PATH%
   ```

### Connection Issues

#### General Connection Troubleshooting
- Verify your database server is accessible from your network
- Check that you're using the correct connection parameters (hostname, port, etc.)
- Verify your credentials have sufficient permissions to access the requested database objects
- Ensure firewalls aren't blocking database traffic

#### Oracle-Specific Connections
- Verify the Oracle service name or SID is correct
- Check that the tnsnames.ora file is correctly configured (if using TNS aliases)
- Ensure the Oracle client version is compatible with the server version

#### PostgreSQL-Specific Connections
- Verify the database name exists
- Check if pg_hba.conf allows your connection type
- Ensure SSL settings match server requirements (if applicable)

#### MySQL-Specific Connections
- Check if the user has necessary privileges for the specified database
- Verify authentication plugin compatibility
- Ensure character set and collation settings are appropriate

#### SQL Server-Specific Connections
- Check if the server allows SQL authentication (if not using Windows auth)
- Verify the correct instance name is specified for named instances
- Ensure the SQL Browser service is running if connecting to a named instance

### API Key Issues

If you receive errors about missing OpenAI API key:
1. Verify your API key is correctly set in the environment
2. Restart the application after setting the API key