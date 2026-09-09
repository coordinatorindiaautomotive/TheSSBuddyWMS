const fs = require('fs');
const path = require('path');
const mssql = require('mssql');
const sqlite3 = require('sqlite3').verbose();
const { Client: PgClient } = require('pg');
const mysql = require('mysql2/promise');

const configPath = path.join(__dirname, '../../config.json');

function getConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {}

  return {
    dbType: 'SQLITE',
    sqlite: { dbPath: 'data/wms_enterprise.db' },
    mssql: {
      host: '172.20.25.5',
      port: 1433,
      database: 'WmsEnterpriseDb',
      user: 'sa',
      password: 'Admin@12345',
      encrypt: false,
      trustServerCertificate: true
    },
    postgres: {
      host: '127.0.0.1',
      port: 5432,
      database: 'wms_enterprise_db',
      user: 'postgres',
      password: ''
    },
    mysql: {
      host: '127.0.0.1',
      port: 3306,
      database: 'wms_enterprise_db',
      user: 'root',
      password: ''
    },
    server: { port: 5000, host: '0.0.0.0' }
  };
}

function saveConfig(newConfig) {
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
  return newConfig;
}

async function testConnection(customConfig = null) {
  const cfg = customConfig || getConfig();

  if (cfg.dbType === 'MSSQL') {
    const mssqlConfig = {
      server: cfg.mssql.host,
      port: parseInt(cfg.mssql.port, 10) || 1433,
      database: cfg.mssql.database,
      user: cfg.mssql.user,
      password: cfg.mssql.password,
      options: {
        encrypt: cfg.mssql.encrypt || false,
        trustServerCertificate: cfg.mssql.trustServerCertificate !== false,
        connectTimeout: 5000
      }
    };

    let pool;
    try {
      pool = await new mssql.ConnectionPool(mssqlConfig).connect();
      const result = await pool.request().query('SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES');
      await pool.close();
      return {
        success: true,
        message: `Successfully connected to MSSQL Server (${cfg.mssql.host}:${cfg.mssql.port} / DB: ${cfg.mssql.database})`,
        tablesFound: result.recordset[0].count
      };
    } catch (err) {
      if (pool) try { await pool.close(); } catch(e){}
      return {
        success: false,
        message: `MSSQL Connection Failed: ${err.message}`
      };
    }
  } else if (cfg.dbType === 'POSTGRES') {
    const pgClient = new PgClient({
      host: cfg.postgres.host,
      port: parseInt(cfg.postgres.port, 10) || 5432,
      database: cfg.postgres.database,
      user: cfg.postgres.user,
      password: cfg.postgres.password,
      connectionTimeoutMillis: 5000
    });

    try {
      await pgClient.connect();
      const res = await pgClient.query("SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public'");
      await pgClient.end();
      return {
        success: true,
        message: `Successfully connected to PostgreSQL Server (${cfg.postgres.host}:${cfg.postgres.port} / DB: ${cfg.postgres.database})`,
        tablesFound: parseInt(res.rows[0].count, 10)
      };
    } catch (err) {
      try { await pgClient.end(); } catch(e){}
      return {
        success: false,
        message: `PostgreSQL Connection Failed: ${err.message}`
      };
    }
  } else if (cfg.dbType === 'MYSQL') {
    try {
      const conn = await mysql.createConnection({
        host: cfg.mysql.host,
        port: parseInt(cfg.mysql.port, 10) || 3306,
        database: cfg.mysql.database,
        user: cfg.mysql.user,
        password: cfg.mysql.password,
        connectTimeout: 5000
      });

      const [rows] = await conn.query("SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema=?", [cfg.mysql.database]);
      await conn.end();

      return {
        success: true,
        message: `Successfully connected to MySQL/MariaDB Server (${cfg.mysql.host}:${cfg.mysql.port} / DB: ${cfg.mysql.database})`,
        tablesFound: rows[0] ? rows[0].count : 0
      };
    } catch (err) {
      return {
        success: false,
        message: `MySQL Connection Failed: ${err.message}`
      };
    }
  } else {
    // SQLite Mode
    return new Promise((resolve) => {
      const dbFile = path.resolve(__dirname, '../../', cfg.sqlite.dbPath || 'data/wms_enterprise.db');
      const testDb = new sqlite3.Database(dbFile, (err) => {
        if (err) {
          return resolve({ success: false, message: `SQLite Failed: ${err.message}` });
        }
        testDb.get("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'", (err2, row) => {
          testDb.close();
          if (err2) {
            return resolve({ success: false, message: `SQLite Read Error: ${err2.message}` });
          }
          resolve({
            success: true,
            message: `Successfully connected to SQLite database (${path.basename(dbFile)})`,
            tablesFound: row ? row.count : 0
          });
        });
      });
    });
  }
}

module.exports = {
  getConfig,
  saveConfig,
  testConnection
};
