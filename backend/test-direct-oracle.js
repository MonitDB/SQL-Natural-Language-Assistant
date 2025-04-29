const oracledb = require('oracledb');

async function testConnection() {
  let connection;
  
  try {
    // Configure oracle client
    oracledb.autoCommit = true;
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    
    // Attempt connection
    console.log('Attempting to connect to Oracle database...');
    connection = await oracledb.getConnection({
      user: 'monitx',
      password: 'teste',
      connectString: 'monitdb-dev.ddns.net:1521/orcl',
    });
    
    console.log('Connected to Oracle database!');
    
    // Test simple query
    console.log('Running simple query to check connection...');
    const result = await connection.execute(
      'SELECT SYS_CONTEXT(\'USERENV\', \'DB_NAME\') as DB_NAME FROM dual'
    );
    
    console.log('Query result:', result.rows);
    
    // Get basic info about tables
    console.log('Checking for non-system tables...');
    const tablesResult = await connection.execute(
      'SELECT owner, table_name FROM all_tables WHERE owner NOT IN (\'SYS\', \'SYSTEM\', \'MDSYS\', \'CTXSYS\', \'DBSNMP\', \'OUTLN\') AND ROWNUM <= 10'
    );
    
    console.log('Found tables:', tablesResult.rows);
    
    // Check user_tables
    console.log('Checking for user tables...');
    const userTablesResult = await connection.execute(
      'SELECT table_name FROM user_tables WHERE ROWNUM <= 5'
    );
    
    console.log('Found user tables:', userTablesResult.rows);
    
    // Specifically check the HR.REGIONS table that was found
    console.log('\nExamining HR.REGIONS table structure:');
    const columnsResult = await connection.execute(
      'SELECT column_name, data_type, data_length, nullable FROM all_tab_columns WHERE owner = \'HR\' AND table_name = \'REGIONS\' ORDER BY column_id'
    );
    
    console.log('Columns in HR.REGIONS:', columnsResult.rows);
    
    // Get sample data from the HR.REGIONS table
    console.log('\nSample data from HR.REGIONS:');
    const sampleDataResult = await connection.execute(
      'SELECT * FROM HR.REGIONS WHERE ROWNUM <= 10'
    );
    
    console.log('Sample data:', sampleDataResult.rows);
    
    // Check for other HR tables
    console.log('\nChecking for other tables in HR schema:');
    const hrTablesResult = await connection.execute(
      'SELECT table_name FROM all_tables WHERE owner = \'HR\' ORDER BY table_name'
    );
    
    console.log('HR tables:', hrTablesResult.rows);
    
  } catch (error) {
    console.error('Error testing Oracle connection:', error);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('Connection closed');
      } catch (error) {
        console.error('Error closing connection:', error);
      }
    }
  }
}

testConnection();