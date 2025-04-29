const oracledb = require('oracledb');
const net = require('net');

// First check basic TCP connectivity
async function checkTcpPort() {
  return new Promise((resolve, reject) => {
    console.log('\n=== TESTING BASIC TCP CONNECTIVITY ===');
    console.log('Testing connection to monitdb-dev.ddns.net:1521...');
    
    const client = new net.Socket();
    client.setTimeout(5000);
    
    client.connect(1521, 'monitdb-dev.ddns.net', function() {
      console.log('✅ TCP CONNECTION SUCCESSFUL: Port 1521 is open and accepting connections.');
      client.end();
      resolve(true);
    });
    
    client.on('error', function(err) {
      console.error(`❌ TCP CONNECTION ERROR: ${err.message}`);
      resolve(false);
    });
    
    client.on('timeout', function() {
      console.error('❌ TCP CONNECTION TIMEOUT: Connection attempt timed out after 5 seconds');
      client.destroy();
      resolve(false);
    });
  });
}

async function testConnection() {
  let connection;
  
  try {
    // First check basic TCP connectivity
    const tcpConnected = await checkTcpPort();
    if (!tcpConnected) {
      console.error('Cannot proceed with Oracle connection test due to TCP connectivity failure');
      return;
    }
    
    console.log('\n=== ORACLE CONNECTION TEST ===');
    console.log('Attempting to connect to Oracle database...');
    
    // Set debug mode
    process.env.NODE_ORACLEDB_DRIVER_MODE = 'thin';
    process.env.NODE_ORACLEDB_DEBUG = 'true';
    
    // Print oracledb version
    console.log(`Using oracledb driver version: ${oracledb.versionString}`);
    console.log(`oracledb driver mode: ${oracledb.thin ? 'thin' : 'thick'}`);
    
    // Configure oracledb
    oracledb.autoCommit = true;
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    oracledb.errorOnConcurrentExecute = false;
    
    // Try using multiple connection string formats
    const connectionConfigs = [
      {
        name: "EZ Connect",
        config: {
          user: 'monitx',
          password: 'teste',
          connectString: 'monitdb-dev.ddns.net:1521/orcl',
          libDir: null,
        }
      },
      {
        name: "TNS Format",
        config: {
          user: 'monitx',
          password: 'teste',
          connectString: '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=monitdb-dev.ddns.net)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=orcl)))',
          libDir: null,
        }
      },
      {
        name: "SID Format",
        config: {
          user: 'monitx',
          password: 'teste',
          connectString: '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=monitdb-dev.ddns.net)(PORT=1521))(CONNECT_DATA=(SID=orcl)))',
          libDir: null,
        }
      }
    ];
    
    // Try each connection method in sequence
    for (const connAttempt of connectionConfigs) {
      console.log(`\n--- Trying connection method: ${connAttempt.name} ---`);
      console.log(`Connecting to: ${connAttempt.config.connectString}`);
      console.log(`Username: ${connAttempt.config.user}`);
      
      // Set a timeout for the connection attempt
      const getConnection = async (config) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timed out after 15 seconds'));
          }, 15000);
          
          oracledb.getConnection(config)
            .then(conn => {
              clearTimeout(timeout);
              resolve(conn);
            })
            .catch(err => {
              clearTimeout(timeout);
              reject(err);
            });
        });
      };
      
      try {
        // Connect to Oracle with timeout
        console.log(`Calling oracledb.getConnection() with 15-second timeout...`);
        connection = await getConnection(connAttempt.config);
        console.log(`✅ Connected to Oracle database successfully with ${connAttempt.name}!`);
        
        // If we got here, we succeeded at connecting, so exit the loop
        break;
      } catch (connErr) {
        console.error(`❌ Connection failed with ${connAttempt.name}: ${connErr.message}`);
        // Continue to next connection method
      }
    }
    
    // If connection is still null after trying all methods, throw an error
    if (!connection) {
      throw new Error('All connection methods failed');
    }
    
    // Attempt to query tables
    try {
      console.log('Querying for accessible tables...');
      
      // Try all_tables first
      const allTablesResult = await connection.execute(
        `SELECT owner, table_name FROM all_tables WHERE ROWNUM <= 10`
      );
      
      console.log(`Found ${allTablesResult.rows.length} tables in ALL_TABLES view`);
      console.log('Result format:', JSON.stringify(allTablesResult.rows[0]));
      
      if (allTablesResult.rows.length > 0) {
        console.log('Sample tables:');
        allTablesResult.rows.slice(0, 5).forEach(row => {
          console.log(`  - ${row.OWNER}.${row.TABLE_NAME}`);
        });
      } else {
        console.log('No tables found in ALL_TABLES view');
        
        // If no tables in all_tables, try user_tables
        const userTablesResult = await connection.execute(
          `SELECT table_name FROM user_tables`
        );
        
        console.log(`Found ${userTablesResult.rows.length} tables in USER_TABLES view`);
        
        if (userTablesResult.rows.length > 0) {
          console.log('Sample tables:');
          userTablesResult.rows.slice(0, 5).forEach(row => {
            console.log(`  - ${row.TABLE_NAME}`);
          });
        } else {
          console.log('⚠️ No tables found in USER_TABLES view');
          console.log('This user does not have access to any tables');
        }
      }
    } catch (queryErr) {
      console.error(`❌ Error querying tables: ${queryErr.message}`);
    }
  } catch (err) {
    console.error('❌ Error connecting to Oracle database:');
    console.error(err);
  } finally {
    if (connection) {
      try {
        // Release the connection
        await connection.close();
        console.log('Connection closed successfully');
      } catch (err) {
        console.error(`Error closing connection: ${err.message}`);
      }
    }
  }
}

testConnection();