const net = require('net');

// Connection parameters
const host = 'monitdb-dev.ddns.net';
const port = 1521;

console.log(`Testing connectivity to Oracle database at ${host}:${port}...`);

const client = new net.Socket();

// Set a timeout
client.setTimeout(5000);

// Attempt to connect
client.connect(port, host, function() {
  console.log(`✅ CONNECTED: Database server ${host}:${port} is reachable!`);
  client.end();
});

// Handle errors
client.on('error', function(err) {
  console.error(`❌ CONNECTION ERROR: Could not connect to ${host}:${port}`);
  console.error(`Error details: ${err.message}`);
  process.exit(1);
});

// Handle timeout
client.on('timeout', function() {
  console.error(`❌ TIMEOUT: Connection to ${host}:${port} timed out after 5 seconds`);
  client.destroy();
  process.exit(1);
});

// Connection closed
client.on('close', function() {
  console.log('Test completed, connection closed');
  process.exit(0);
});