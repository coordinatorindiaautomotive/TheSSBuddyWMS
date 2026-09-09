const fs = require('fs');
const path = require('path');
const mssql = require('mssql');
const sqlite3 = require('sqlite3').verbose();
const { Client: PgClient } = require('pg');
const mysql = require('mysql2/promise');

const configPath = path.join(__dirname, '../../config.json');

function getConfig() {
  let fileConfig = {};
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      fileConfig = JSON.parse(data);
    }
  } catch (e) {}

  return {
    dbType: process.env.DB_TYPE || fileConfig.dbType || 'MYSQL',
    sqlite: { 
      dbPath: process.env.SQLITE_DB_PATH || fileConfig.sqlite?.dbPath || 'data/wms_enterprise.db' 
    },
    mssql: {
      host: process.env.MSSQL_HOST || fileConfig.mssql?.host || '127.0.0.1',
      port: parseInt(process.env.MSSQL_PORT || fileConfig.mssql?.port, 10) || 1433,
      database: process.env.MSSQL_DATABASE || fileConfig.mssql?.database || 'WmsEnterpriseDb',
      user: process.env.MSSQL_USER || fileConfig.mssql?.user || 'sa',
      password: process.env.MSSQL_PASSWORD || fileConfig.mssql?.password || '',
      encrypt: false,
      trustServerCertificate: true
    },
    postgres: {
      host: process.env.PG_HOST || fileConfig.postgres?.host || '127.0.0.1',
      port: parseInt(process.env.PG_PORT || fileConfig.postgres?.port, 10) || 5432,
      database: process.env.PG_DATABASE || fileConfig.postgres?.database || 'wms_enterprise_db',
      user: process.env.PG_USER || fileConfig.postgres?.user || 'postgres',
      password: process.env.PG_PASSWORD || fileConfig.postgres?.password || ''
    },
    mysql: {
      host: process.env.DB_HOST || fileConfig.mysql?.host || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || fileConfig.mysql?.port, 10) || 3306,
      database: process.env.DB_NAME || fileConfig.mysql?.database || 'wms_enterprise_db',
      user: process.env.DB_USER || fileConfig.mysql?.user || 'root',
      password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (fileConfig.mysql?.password || '')
    },
    server: { 
      port: parseInt(process.env.PORT || fileConfig.server?.port, 10) || 5000, 
      host: process.env.HOST || fileConfig.server?.host || '0.0.0.0' 
    }
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
