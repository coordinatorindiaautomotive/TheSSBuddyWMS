const path = require('path');
const { getConfig } = require('./src/config/dbConfigManager');
const mysql = require('mysql2/promise');

async function run() {
  console.log('--- WMS Database Connection Diagnostic ---');
  const cfg = getConfig();
  console.log(`Configured DB Type: ${cfg.dbType}`);
  console.log(`Target Host: ${cfg.mysql.host}:${cfg.mysql.port}`);
  console.log(`Target Database: ${cfg.mysql.database}`);
  console.log(`Target User: ${cfg.mysql.user}`);
  console.log(`Password Configured: ${cfg.mysql.password ? 'YES (Length: ' + cfg.mysql.password.length + ')' : 'NO (EMPTY)'}`);

  try {
    const conn = await mysql.createConnection({
      host: cfg.mysql.host,
      port: parseInt(cfg.mysql.port, 10) || 3306,
      database: cfg.mysql.database,
      user: cfg.mysql.user,
      password: cfg.mysql.password,
      connectTimeout: 5000
    });

    console.log('\n[SUCCESS] MySQL Connected successfully.');

    const [ptRows] = await conn.query('SELECT count(*) as total FROM pick_tickets');
    console.log(`Pick Tickets Count: ${ptRows[0]?.total || 0}`);

    const [routesRows] = await conn.query('SELECT count(*) as total FROM route_masters');
    console.log(`Route Masters Count: ${routesRows[0]?.total || 0}`);

    const [partyRows] = await conn.query('SELECT count(*) as total FROM parties');
    console.log(`Parties Count: ${partyRows[0]?.total || 0}`);

    await conn.end();
    console.log('\nAll tables verified. Live Monitor and Dispatch Planning will reflect real data.');
    process.exit(0);
  } catch (err) {
    console.error(`\n[ERROR] Connection failed: ${err.message}`);
    process.exit(1);
  }
}

run();
