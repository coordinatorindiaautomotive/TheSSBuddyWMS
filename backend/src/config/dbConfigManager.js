const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Search and load .env from multiple possible locations on cPanel / local
const possibleEnvPaths = [
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../../../.env'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'backend/.env'),
  '/home/thesssys/TheSSBuddyWMS/backend/.env',
  '/home/thesssys/public_html/backend/.env',
  '/home/thesssys/public_html/.env'
];

for (const envP of possibleEnvPaths) {
  try {
    if (fs.existsSync(envP)) {
      require('dotenv').config({ path: envP, override: true });
    }
  } catch (e) {}
}

const configPath = path.join(__dirname, '../../config.json');

function getConfig() {
  let fileConfig = {};
  const possibleConfigPaths = [
    configPath,
    path.join(__dirname, '../../../config.json'),
    path.join(process.cwd(), 'config.json'),
    path.join(process.cwd(), 'backend/config.json'),
    '/home/thesssys/TheSSBuddyWMS/backend/config.json',
    '/home/thesssys/public_html/backend/config.json'
  ];

  for (const cp of possibleConfigPaths) {
    try {
      if (fs.existsSync(cp)) {
        const data = fs.readFileSync(cp, 'utf8');
        const parsed = JSON.parse(data);
        fileConfig = { ...fileConfig, ...parsed };
      }
    } catch (e) {}
  }

  return {
    dbType: 'MYSQL',
    mysql: {
      host: process.env.DB_HOST || fileConfig.mysql?.host || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || fileConfig.mysql?.port, 10) || 3306,
      database: process.env.DB_NAME || fileConfig.mysql?.database || 'thesssys_wms_enterprise_db',
      user: process.env.DB_USER || fileConfig.mysql?.user || 'thesssys_shailendra',
      password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (fileConfig.mysql?.password || '')
    },
    server: { 
      port: parseInt(process.env.PORT || fileConfig.server?.port, 10) || 5000, 
      host: process.env.HOST || fileConfig.server?.host || '0.0.0.0' 
    }
  };
}

function saveConfig(newConfig) {
  const current = getConfig();
  const updated = {
    ...current,
    ...newConfig,
    dbType: 'MYSQL'
  };
  fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

async function testConnection(customConfig = null) {
  const cfg = customConfig || getConfig();

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
      message: `Successfully connected to MySQL Database (${cfg.mysql.host}:${cfg.mysql.port} / DB: ${cfg.mysql.database})`,
      tablesFound: rows[0] ? rows[0].count : 0
    };
  } catch (err) {
    return {
      success: false,
      message: `MySQL Connection Failed: ${err.message}`
    };
  }
}

module.exports = {
  getConfig,
  saveConfig,
  testConnection
};
