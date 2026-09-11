const mysql = require('mysql2/promise');
let sqlite3 = null;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (e) {
  // SQLite native bindings not installed/needed when running on MySQL in cPanel
}
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { getConfig } = require('./dbConfigManager');

let activeDbType = 'MYSQL';
let mysqlPool = null;
let sqliteDb = null;
let isConnected = false;

function getDbConfig() {
  const config = getConfig();
  return {
    dbType: (config.dbType || 'MYSQL').toUpperCase(),
    mysql: config.mysql || {
      host: '127.0.0.1',
      port: 3306,
      database: 'wms_enterprise_db',
      user: 'root',
      password: 'root'
    },
    sqlite: config.sqlite || {
      dbPath: 'data/wms_enterprise.db'
    }
  };
}

async function ensureMySQLDatabase(cfg) {
  try {
    const rootConn = await mysql.createConnection({
      host: cfg.mysql.host || '127.0.0.1',
      port: parseInt(cfg.mysql.port, 10) || 3306,
      user: cfg.mysql.user || 'root',
      password: cfg.mysql.password || '',
      connectTimeout: 5000
    });
    const dbName = cfg.mysql.database || 'wms_enterprise_db';
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rootConn.end();
  } catch (err) {
    console.warn(`[MySQL Notice] Could not auto-create database: ${err.message}. Attempting direct connection...`);
  }
}

async function connectMySQL(cfg) {
  await ensureMySQLDatabase(cfg);

  mysqlPool = mysql.createPool({
    host: cfg.mysql.host || '127.0.0.1',
    port: parseInt(cfg.mysql.port, 10) || 3306,
    user: cfg.mysql.user || 'root',
    password: cfg.mysql.password || '',
    database: cfg.mysql.database || 'wms_enterprise_db',
    waitForConnections: true,
    connectionLimit: 25,
    queueLimit: 0,
    decimalNumbers: true,
    dateStrings: true,
    timezone: '+05:30'
  });

  // Verify connection
  const conn = await mysqlPool.getConnection();
  conn.release();
  isConnected = true;
  activeDbType = 'MYSQL';
  console.log(`✅ MySQL Connected successfully! Database: ${cfg.mysql.database} @ ${cfg.mysql.host}:${cfg.mysql.port}`);
}

function connectSQLite(cfg) {
  if (!sqlite3) {
    console.warn('⚠️ SQLite3 driver not loaded (native addon missing). Running in Memory Fallback mode until MySQL is configured in UI.');
    isConnected = false;
    return;
  }
  const dbPath = path.resolve(__dirname, '../../', cfg.sqlite.dbPath || 'data/wms_enterprise.db');
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('⚠️ SQLite Connection Error:', err.message);
      isConnected = false;
    } else {
      console.log(`✅ SQLite Database connected (${path.basename(dbPath)})`);
      isConnected = true;
      activeDbType = 'SQLITE';
    }
  });

  sqliteDb.on('error', (err) => {
    console.error('⚠️ SQLite Runtime Error:', err.message);
    isConnected = false;
  });
}

async function ensureConnected() {
  if (activeDbType === 'MYSQL' && !mysqlPool) {
    const cfg = getDbConfig();
    await connectMySQL(cfg);
  } else if (activeDbType === 'SQLITE' && !sqliteDb) {
    const cfg = getDbConfig();
    connectSQLite(cfg);
  }
}

const dbAsync = {
  async run(sql, params = []) {
    await ensureConnected();
    if (activeDbType === 'MYSQL') {
      const cleanParams = params.map(p => (p === undefined ? null : p));
      const [result] = await mysqlPool.execute(sql, cleanParams);
      return { id: result.insertId, changes: result.affectedRows };
    } else {
      return new Promise((resolve, reject) => {
        if (!sqliteDb) return reject(new Error('SQLite database is not initialized.'));
        sqliteDb.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, changes: this.changes });
        });
      });
    }
  },

  async get(sql, params = []) {
    await ensureConnected();
    if (activeDbType === 'MYSQL') {
      const cleanParams = params.map(p => (p === undefined ? null : p));
      const [rows] = await mysqlPool.execute(sql, cleanParams);
      return rows && rows.length > 0 ? rows[0] : null;
    } else {
      return new Promise((resolve, reject) => {
        if (!sqliteDb) return reject(new Error('SQLite database is not initialized.'));
        sqliteDb.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        });
      });
    }
  },

  async all(sql, params = []) {
    await ensureConnected();
    if (activeDbType === 'MYSQL') {
      const cleanParams = params.map(p => (p === undefined ? null : p));
      const [rows] = await mysqlPool.execute(sql, cleanParams);
      return rows || [];
    } else {
      return new Promise((resolve, reject) => {
        if (!sqliteDb) return reject(new Error('SQLite database is not initialized.'));
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    }
  },

  async exec(sql) {
    await ensureConnected();
    if (activeDbType === 'MYSQL') {
      return await mysqlPool.query(sql);
    } else {
      return new Promise((resolve, reject) => {
        if (!sqliteDb) return reject(new Error('SQLite database is not initialized.'));
        sqliteDb.exec(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
};

async function initDatabase() {
  const cfg = getDbConfig();

  if (cfg.dbType === 'MYSQL') {
    try {
      await connectMySQL(cfg);
    } catch (err) {
      console.error(`⚠️ MySQL Initialization Failed: ${err.message}. Falling back to SQLite temporary store...`);
      connectSQLite(cfg);
    }
  } else {
    connectSQLite(cfg);
  }

  if (activeDbType === 'MYSQL' && isConnected) {
    await initMySQLSchema();
    await ensureDefaultSeed();
  } else if (activeDbType === 'SQLITE' && isConnected) {
    await initSQLiteSchema();
    await ensureDefaultSeed();
  } else {
    console.log('ℹ️ Server waiting for MySQL credentials to be configured via System Configuration / UI.');
  }
}

async function initMySQLSchema() {
  // 1. Warehouses
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      warehouse_code VARCHAR(100) UNIQUE NOT NULL,
      warehouse_name VARCHAR(255) NOT NULL,
      address TEXT,
      contact_number VARCHAR(100),
      contact_person VARCHAR(255),
      email VARCHAR(255),
      prefix_logic VARCHAR(50) DEFAULT 'PIK26-',
      is_active TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 2. Users
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      role VARCHAR(100) NOT NULL DEFAULT 'Dispatcher',
      role_name VARCHAR(100) DEFAULT 'Dispatcher',
      warehouse_id INT NULL,
      is_active TINYINT DEFAULT 1,
      last_login DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 3. Route Masters
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS route_masters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      route_code VARCHAR(100) NOT NULL,
      route_name VARCHAR(255) NOT NULL,
      warehouse_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 3b. Route Schedules (Dynamic Dispatch & Cutoff Timers per Route)
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS route_schedules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      route_id INT NOT NULL,
      trip_name VARCHAR(255) NOT NULL,
      dispatch_type VARCHAR(50) NOT NULL DEFAULT 'FIXED',
      frequency VARCHAR(50) NOT NULL DEFAULT 'DAILY',
      selected_days VARCHAR(255) DEFAULT '["Mon","Tue","Wed","Thu","Fri","Sat"]',
      cutoff_time VARCHAR(20) DEFAULT '06:00',
      dispatch_time VARCHAR(20) DEFAULT '08:00',
      is_active TINYINT DEFAULT 1,
      priority_order INT DEFAULT 1,
      warehouse_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES route_masters(id) ON DELETE CASCADE,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
      INDEX idx_rs_route (route_id),
      INDEX idx_rs_wh (warehouse_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 4. Parties (Customers - Isolated per warehouse)
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS parties (
      id INT AUTO_INCREMENT PRIMARY KEY,
      party_code VARCHAR(100) NOT NULL,
      party_name VARCHAR(255) NOT NULL,
      address TEXT,
      city VARCHAR(100),
      phone VARCHAR(100),
      gstin VARCHAR(100),
      salesman VARCHAR(255) DEFAULT 'General Sales',
      route_name VARCHAR(255) DEFAULT 'Direct Route',
      credit_limit DECIMAL(15,2) DEFAULT 0,
      current_balance DECIMAL(15,2) DEFAULT 0,
      warehouse_id INT NOT NULL,
      route_id INT NULL,
      lat DOUBLE NULL,
      lng DOUBLE NULL,
      is_active TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_party_warehouse (party_code, warehouse_id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT,
      FOREIGN KEY (route_id) REFERENCES route_masters(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Migrate existing MySQL parties table unique key if needed
  try {
    const indexes = await dbAsync.all(`
      SELECT INDEX_NAME FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'parties' AND INDEX_NAME = 'party_code'
    `);
    if (indexes && indexes.length > 0) {
      await dbAsync.exec('ALTER TABLE parties DROP INDEX party_code;');
      const uqExists = await dbAsync.all(`
        SELECT INDEX_NAME FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'parties' AND INDEX_NAME = 'uq_party_warehouse'
      `);
      if (!uqExists || uqExists.length === 0) {
        await dbAsync.exec('ALTER TABLE parties ADD UNIQUE KEY uq_party_warehouse (party_code, warehouse_id);');
      }
    }
  } catch (e) {}

  // 5. Picker Checker Helpers
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS picker_checker_helpers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_code VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      mobile VARCHAR(100),
      phone VARCHAR(100),
      role VARCHAR(100),
      role_type VARCHAR(100) NOT NULL DEFAULT 'Picker',
      warehouse_id INT NOT NULL,
      is_active TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 6. Drivers
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      driver_name VARCHAR(255),
      name VARCHAR(255),
      mobile VARCHAR(100),
      phone VARCHAR(100),
      license_number VARCHAR(100),
      license_no VARCHAR(100),
      route VARCHAR(255),
      status VARCHAR(100) DEFAULT 'Available',
      is_active TINYINT DEFAULT 1,
      driver_pin VARCHAR(50) DEFAULT '1234',
      device_token VARCHAR(255),
      emergency_contact VARCHAR(100),
      photo_url TEXT,
      last_seen_at DATETIME NULL,
      current_latitude DOUBLE NULL,
      current_longitude DOUBLE NULL,
      warehouse_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 7. Vehicles
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vehicle_number VARCHAR(100) UNIQUE NOT NULL,
      vehicle_type VARCHAR(100),
      capacity VARCHAR(100),
      capacity_tons DECIMAL(10,2) NULL,
      registration_no VARCHAR(100),
      driver_id INT NULL,
      status VARCHAR(100) DEFAULT 'Available',
      is_active TINYINT DEFAULT 1,
      warehouse_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 8. Salesman Masters
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS salesman_masters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      salesman_code VARCHAR(100) UNIQUE NOT NULL,
      salesman_name VARCHAR(255) NOT NULL,
      mobile VARCHAR(100),
      phone VARCHAR(100),
      email VARCHAR(255),
      territory VARCHAR(255),
      warehouse_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 9. Salesmen legacy table
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS salesmen (
      id INT AUTO_INCREMENT PRIMARY KEY,
      salesman_code VARCHAR(100),
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(100),
      territory VARCHAR(255),
      warehouse_id INT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  try {
    await dbAsync.exec('ALTER TABLE salesmen ADD COLUMN warehouse_id INT NULL DEFAULT 1;');
  } catch (e) {}

  // 10. Pick Tickets
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS pick_tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date VARCHAR(50) NOT NULL,
      time VARCHAR(50) NOT NULL,
      ticket_no VARCHAR(100) NOT NULL,
      customer_order_no VARCHAR(100),
      qty_in_pick_ticket INT DEFAULT 1,
      picker_id VARCHAR(100),
      party_code VARCHAR(100) NOT NULL,
      party_name VARCHAR(255) NOT NULL,
      route VARCHAR(255) NOT NULL,
      salesman VARCHAR(255) NOT NULL,
      priority VARCHAR(50) DEFAULT 'Normal',
      remarks TEXT,
      status VARCHAR(100) DEFAULT 'Assigned',
      warehouse_id INT NOT NULL,
      created_by VARCHAR(100) DEFAULT 'System',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pt_warehouse (warehouse_id),
      INDEX idx_pt_ticket_no (ticket_no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  try {
    await dbAsync.exec('ALTER TABLE pick_tickets ADD COLUMN updated_at DATETIME NULL;');
  } catch (e) {}

  // 11. Billings
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS billings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pick_ticket_id INT NOT NULL,
      billing_date VARCHAR(50) NOT NULL,
      billing_time VARCHAR(50) NOT NULL,
      bill_no VARCHAR(100) NOT NULL,
      billed_qty INT DEFAULT 1,
      checker_id VARCHAR(100),
      helper_id VARCHAR(100),
      start_time DATETIME NULL,
      end_time DATETIME NULL,
      invoice_amount DECIMAL(15,2) DEFAULT 0,
      short_qty INT DEFAULT 0,
      excess_qty INT DEFAULT 0,
      damage_qty INT DEFAULT 0,
      billing_remarks TEXT,
      warehouse_id INT NOT NULL,
      created_by VARCHAR(100) DEFAULT 'System',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pick_ticket_id) REFERENCES pick_tickets(id) ON DELETE CASCADE,
      INDEX idx_billings_warehouse (warehouse_id),
      INDEX idx_billings_bill_no (bill_no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Ensure all columns exist on billings for existing tables
  const billingColumns = [
    { name: 'pick_ticket_id', type: 'INT NOT NULL DEFAULT 0' },
    { name: 'billing_date', type: 'VARCHAR(50) NOT NULL DEFAULT \'\'' },
    { name: 'billing_time', type: 'VARCHAR(50) NOT NULL DEFAULT \'10:00\'' },
    { name: 'bill_no', type: 'VARCHAR(100) NOT NULL DEFAULT \'\'' },
    { name: 'billed_qty', type: 'INT DEFAULT 1' },
    { name: 'checker_id', type: 'VARCHAR(100) NULL' },
    { name: 'helper_id', type: 'VARCHAR(100) NULL' },
    { name: 'start_time', type: 'DATETIME NULL' },
    { name: 'end_time', type: 'DATETIME NULL' },
    { name: 'invoice_amount', type: 'DECIMAL(15,2) DEFAULT 0' },
    { name: 'short_qty', type: 'INT DEFAULT 0' },
    { name: 'excess_qty', type: 'INT DEFAULT 0' },
    { name: 'damage_qty', type: 'INT DEFAULT 0' },
    { name: 'billing_remarks', type: 'TEXT NULL' },
    { name: 'warehouse_id', type: 'INT NOT NULL DEFAULT 1' },
    { name: 'created_by', type: 'VARCHAR(100) DEFAULT \'System\'' }
  ];

  for (const col of billingColumns) {
    try {
      await dbAsync.exec(`ALTER TABLE billings ADD COLUMN ${col.name} ${col.type};`);
    } catch (e) {}
  }

  // 12. Dispatches
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS dispatches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dispatch_no VARCHAR(100) NOT NULL,
      route VARCHAR(255),
      driver_id INT NOT NULL,
      vehicle_id INT NOT NULL,
      eway_bill VARCHAR(100),
      lr_number VARCHAR(100),
      dispatch_date VARCHAR(50),
      dispatch_time VARCHAR(50),
      total_cartons INT DEFAULT 0,
      scanned_cartons INT DEFAULT 0,
      total_amount DECIMAL(15,2) DEFAULT 0,
      eta DATETIME NULL,
      pod_status VARCHAR(100) DEFAULT 'Pending',
      gps_status VARCHAR(100) DEFAULT 'Inactive',
      status VARCHAR(100) DEFAULT 'In Transit',
      dispatch_remarks TEXT,
      notes TEXT,
      started_at DATETIME NULL,
      completed_at DATETIME NULL,
      warehouse_id INT NOT NULL,
      created_by VARCHAR(100) DEFAULT 'System',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_dispatches_warehouse (warehouse_id),
      INDEX idx_dispatches_no (dispatch_no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 13. Dispatch Parties
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS dispatch_parties (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dispatch_id INT NOT NULL,
      billing_id INT NOT NULL,
      party_code VARCHAR(100) NOT NULL,
      party_name VARCHAR(255),
      total_cartons INT DEFAULT 1,
      scanned_cartons INT DEFAULT 0,
      material_description TEXT,
      status VARCHAR(100) DEFAULT 'In Transit',
      delivery_status VARCHAR(100) DEFAULT 'Assigned',
      delivery_notes TEXT,
      delivered_at DATETIME NULL,
      latitude DOUBLE NULL,
      longitude DOUBLE NULL,
      receiver_name VARCHAR(255),
      receiver_mobile VARCHAR(100),
      stop_name VARCHAR(255),
      stop_sequence INT DEFAULT 1,
      signature_data LONGTEXT,
      otp_code VARCHAR(20),
      otp_verified TINYINT DEFAULT 0,
      warehouse_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dispatch_id) REFERENCES dispatches(id) ON DELETE CASCADE,
      FOREIGN KEY (billing_id) REFERENCES billings(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 14. Cartons
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS cartons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      barcode_no VARCHAR(100) NOT NULL,
      dispatch_party_id INT NULL,
      dispatch_id INT NOT NULL,
      warehouse_id INT NOT NULL,
      is_scanned TINYINT DEFAULT 0,
      scanned_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dispatch_id) REFERENCES dispatches(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 15. E-Way Bills
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS eway_bills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ewb_no VARCHAR(100),
      ewb_date DATETIME NULL,
      dispatch_id INT NULL,
      doc_no VARCHAR(100) NOT NULL,
      doc_date VARCHAR(50),
      party_name VARCHAR(255) NOT NULL,
      gstin VARCHAR(100),
      hsn_code VARCHAR(100),
      quantity INT DEFAULT 1,
      taxable_value DECIMAL(15,2) DEFAULT 0,
      cgst_value DECIMAL(15,2) DEFAULT 0,
      sgst_value DECIMAL(15,2) DEFAULT 0,
      igst_value DECIMAL(15,2) DEFAULT 0,
      total_value DECIMAL(15,2) DEFAULT 0,
      status VARCHAR(100) DEFAULT 'Generated',
      warehouse_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 16. Audit Logs
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      warehouse_id INT NULL,
      user_id INT NULL,
      user_name VARCHAR(255),
      user_role VARCHAR(100),
      user_ip VARCHAR(100),
      action_type VARCHAR(100) NOT NULL,
      module VARCHAR(100) NOT NULL,
      target_id VARCHAR(255),
      details TEXT,
      changed_fields TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 17. Notifications
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      message TEXT NOT NULL,
      type VARCHAR(100) DEFAULT 'Info',
      warehouse_id INT NULL,
      is_read TINYINT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 18. Performance Logs
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS performance_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      worker_name VARCHAR(255) NOT NULL,
      role VARCHAR(100) NOT NULL,
      task_count INT DEFAULT 0,
      warehouse_id INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function initSQLiteSchema() {
  await dbAsync.exec('PRAGMA foreign_keys = ON;');

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_code TEXT UNIQUE NOT NULL,
      warehouse_name TEXT NOT NULL,
      address TEXT,
      contact_number TEXT,
      contact_person TEXT,
      email TEXT,
      prefix_logic TEXT DEFAULT 'PIK26-',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Dispatcher',
      role_name TEXT DEFAULT 'Dispatcher',
      warehouse_id INTEGER,
      is_active INTEGER DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE SET NULL
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS route_masters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_code TEXT NOT NULL,
      route_name TEXT NOT NULL,
      warehouse_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE CASCADE
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS route_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      trip_name TEXT NOT NULL,
      dispatch_type TEXT NOT NULL DEFAULT 'FIXED',
      frequency TEXT NOT NULL DEFAULT 'DAILY',
      selected_days TEXT DEFAULT '["Mon","Tue","Wed","Thu","Fri","Sat"]',
      cutoff_time TEXT DEFAULT '06:00',
      dispatch_time TEXT DEFAULT '08:00',
      is_active INTEGER DEFAULT 1,
      priority_order INTEGER DEFAULT 1,
      warehouse_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES route_masters (id) ON DELETE CASCADE,
      FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE CASCADE
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_code TEXT NOT NULL,
      party_name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      phone TEXT,
      gstin TEXT,
      salesman TEXT DEFAULT 'General Sales',
      route_name TEXT DEFAULT 'Direct Route',
      credit_limit REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      warehouse_id INTEGER NOT NULL,
      route_id INTEGER,
      lat REAL,
      lng REAL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (party_code, warehouse_id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE RESTRICT,
      FOREIGN KEY (route_id) REFERENCES route_masters (id) ON DELETE SET NULL
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS picker_checker_helpers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      mobile TEXT,
      phone TEXT,
      role TEXT,
      role_type TEXT NOT NULL DEFAULT 'Picker',
      warehouse_id INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_name TEXT,
      name TEXT,
      mobile TEXT,
      phone TEXT,
      license_number TEXT,
      license_no TEXT,
      route TEXT,
      status TEXT DEFAULT 'Available',
      is_active INTEGER DEFAULT 1,
      driver_pin TEXT DEFAULT '1234',
      device_token TEXT,
      emergency_contact TEXT,
      photo_url TEXT,
      last_seen_at DATETIME,
      current_latitude REAL,
      current_longitude REAL,
      warehouse_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_number TEXT UNIQUE NOT NULL,
      vehicle_type TEXT,
      capacity TEXT,
      capacity_tons REAL,
      registration_no TEXT,
      driver_id INTEGER,
      status TEXT DEFAULT 'Available',
      is_active INTEGER DEFAULT 1,
      warehouse_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS salesman_masters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salesman_code TEXT UNIQUE NOT NULL,
      salesman_name TEXT NOT NULL,
      mobile TEXT,
      phone TEXT,
      email TEXT,
      territory TEXT,
      warehouse_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS salesmen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salesman_code TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      territory TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS pick_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      ticket_no TEXT NOT NULL,
      customer_order_no TEXT,
      qty_in_pick_ticket INTEGER DEFAULT 1,
      picker_id TEXT,
      party_code TEXT NOT NULL,
      party_name TEXT NOT NULL,
      route TEXT NOT NULL,
      salesman TEXT NOT NULL,
      priority TEXT DEFAULT 'Normal',
      remarks TEXT,
      status TEXT DEFAULT 'Assigned',
      warehouse_id INTEGER NOT NULL,
      created_by TEXT DEFAULT 'System',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS billings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pick_ticket_id INTEGER NOT NULL,
      billing_date TEXT NOT NULL,
      billing_time TEXT NOT NULL,
      bill_no TEXT NOT NULL,
      billed_qty INTEGER DEFAULT 1,
      checker_id TEXT,
      helper_id TEXT,
      start_time DATETIME,
      end_time DATETIME,
      invoice_amount REAL DEFAULT 0,
      short_qty INTEGER DEFAULT 0,
      excess_qty INTEGER DEFAULT 0,
      damage_qty INTEGER DEFAULT 0,
      billing_remarks TEXT,
      warehouse_id INTEGER NOT NULL,
      created_by TEXT DEFAULT 'System',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pick_ticket_id) REFERENCES pick_tickets (id) ON DELETE CASCADE
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS dispatches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dispatch_no TEXT NOT NULL,
      route TEXT,
      driver_id INTEGER NOT NULL,
      vehicle_id INTEGER NOT NULL,
      eway_bill TEXT,
      lr_number TEXT,
      dispatch_date TEXT,
      dispatch_time TEXT,
      total_cartons INTEGER DEFAULT 0,
      scanned_cartons INTEGER DEFAULT 0,
      total_amount REAL DEFAULT 0,
      eta DATETIME,
      pod_status TEXT DEFAULT 'Pending',
      gps_status TEXT DEFAULT 'Inactive',
      status TEXT DEFAULT 'In Transit',
      dispatch_remarks TEXT,
      notes TEXT,
      started_at DATETIME,
      completed_at DATETIME,
      warehouse_id INTEGER NOT NULL,
      created_by TEXT DEFAULT 'System',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS dispatch_parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dispatch_id INTEGER NOT NULL,
      billing_id INTEGER NOT NULL,
      party_code TEXT NOT NULL,
      party_name TEXT,
      total_cartons INTEGER DEFAULT 1,
      scanned_cartons INTEGER DEFAULT 0,
      material_description TEXT,
      status TEXT DEFAULT 'In Transit',
      delivery_status TEXT DEFAULT 'Assigned',
      delivery_notes TEXT,
      delivered_at DATETIME,
      latitude REAL,
      longitude REAL,
      receiver_name TEXT,
      receiver_mobile TEXT,
      stop_name TEXT,
      stop_sequence INTEGER DEFAULT 1,
      signature_data TEXT,
      otp_code TEXT,
      otp_verified INTEGER DEFAULT 0,
      warehouse_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dispatch_id) REFERENCES dispatches (id) ON DELETE CASCADE,
      FOREIGN KEY (billing_id) REFERENCES billings (id) ON DELETE CASCADE
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS cartons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode_no TEXT NOT NULL,
      dispatch_party_id INTEGER,
      dispatch_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      is_scanned INTEGER DEFAULT 0,
      scanned_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dispatch_id) REFERENCES dispatches (id) ON DELETE CASCADE
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS eway_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ewb_no TEXT,
      ewb_date DATETIME,
      dispatch_id INTEGER,
      doc_no TEXT NOT NULL,
      doc_date TEXT,
      party_name TEXT NOT NULL,
      gstin TEXT,
      hsn_code TEXT,
      quantity INTEGER DEFAULT 1,
      taxable_value REAL DEFAULT 0,
      cgst_value REAL DEFAULT 0,
      sgst_value REAL DEFAULT 0,
      igst_value REAL DEFAULT 0,
      total_value REAL DEFAULT 0,
      status TEXT DEFAULT 'Generated',
      warehouse_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER,
      user_id INTEGER,
      user_name TEXT,
      user_role TEXT,
      user_ip TEXT,
      action_type TEXT NOT NULL,
      module TEXT NOT NULL,
      target_id TEXT,
      details TEXT,
      changed_fields TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'Info',
      warehouse_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS performance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_name TEXT NOT NULL,
      role TEXT NOT NULL,
      task_count INTEGER DEFAULT 0,
      warehouse_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function ensureDefaultSeed() {
  try {
    const existingWarehouse = await dbAsync.get('SELECT id FROM warehouses LIMIT 1');
    if (!existingWarehouse) {
      console.log('🌱 Database is empty. Seeding essential default warehouse and superadmin...');
      const whRes = await dbAsync.run(`
        INSERT INTO warehouses (warehouse_code, warehouse_name, address, contact_number, prefix_logic, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `, ['WH-CENTRAL', 'Central Logistics Hub', 'Sector 62, Industrial Area, Noida', '+91 98765 43210', 'PIK26-']);
      
      const whId = whRes.id || 1;
      const pwdHash = await bcrypt.hash('admin123', 10);

      await dbAsync.run(`
        INSERT INTO users (username, email, password_hash, full_name, role, role_name, warehouse_id, is_active)
        VALUES (?, ?, ?, ?, 'SuperAdmin', 'Super Admin', ?, 1)
      `, ['admin', 'admin@thessbuddy.com', pwdHash, 'System Super Admin', whId]);

      console.log('✅ Default SuperAdmin created: (Username: admin / Password: admin123)');
    }

    // Seed default route schedules if routes exist but have no schedules
    const existingSchedules = await dbAsync.get('SELECT id FROM route_schedules LIMIT 1');
    if (!existingSchedules) {
      const routes = await dbAsync.all('SELECT * FROM route_masters');
      for (const r of routes) {
        const nameLower = (r.route_name || '').toLowerCase();
        if (nameLower.includes('jaipur')) {
          // Morning & Evening trips
          await dbAsync.run(`
            INSERT INTO route_schedules (route_id, trip_name, dispatch_type, frequency, selected_days, cutoff_time, dispatch_time, is_active, priority_order, warehouse_id)
            VALUES (?, 'Morning Trip', 'FIXED', 'DAILY', '["Mon","Tue","Wed","Thu","Fri","Sat"]', '06:00', '08:00', 1, 1, ?)
          `, [r.id, r.warehouse_id]);
          await dbAsync.run(`
            INSERT INTO route_schedules (route_id, trip_name, dispatch_type, frequency, selected_days, cutoff_time, dispatch_time, is_active, priority_order, warehouse_id)
            VALUES (?, 'Evening Trip', 'FIXED', 'DAILY', '["Mon","Tue","Wed","Thu","Fri","Sat"]', '17:00', '19:00', 1, 2, ?)
          `, [r.id, r.warehouse_id]);
        } else if (nameLower.includes('kota')) {
          // Mon & Thu
          await dbAsync.run(`
            INSERT INTO route_schedules (route_id, trip_name, dispatch_type, frequency, selected_days, cutoff_time, dispatch_time, is_active, priority_order, warehouse_id)
            VALUES (?, 'Morning Trip', 'FIXED', 'SELECTED_WEEKDAYS', '["Mon","Thu"]', '06:00', '08:00', 1, 1, ?)
          `, [r.id, r.warehouse_id]);
        } else if (nameLower.includes('delhi')) {
          // On-Demand
          await dbAsync.run(`
            INSERT INTO route_schedules (route_id, trip_name, dispatch_type, frequency, selected_days, cutoff_time, dispatch_time, is_active, priority_order, warehouse_id)
            VALUES (?, 'On-Demand Dispatch', 'ON_DEMAND', 'ON_DEMAND', '[]', '', '', 1, 1, ?)
          `, [r.id, r.warehouse_id]);
        } else {
          // Daily general schedule
          await dbAsync.run(`
            INSERT INTO route_schedules (route_id, trip_name, dispatch_type, frequency, selected_days, cutoff_time, dispatch_time, is_active, priority_order, warehouse_id)
            VALUES (?, 'Main Trip', 'FIXED', 'DAILY', '["Mon","Tue","Wed","Thu","Fri","Sat"]', '10:00', '12:00', 1, 1, ?)
          `, [r.id, r.warehouse_id]);
        }
      }
      console.log('✅ Default route schedules seeded for existing routes.');
    }
  } catch (err) {
    console.warn('Seed check notice:', err.message);
  }
}

module.exports = {
  dbAsync,
  initDatabase,
  get activeDbType() { return activeDbType; },
  get isConnected() { return isConnected; }
};

