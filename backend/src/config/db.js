const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { getConfig } = require('./dbConfigManager');

let activeDbType = 'MYSQL';
let mysqlPool = null;
let isConnected = false;

function getDbConfig() {
  const config = getConfig();
  return {
    dbType: 'MYSQL',
    mysql: config.mysql || {
      host: '127.0.0.1',
      port: 3306,
      database: 'thesssys_wms_enterprise_db',
      user: 'thesssys_shailendra',
      password: ''
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
    const dbName = cfg.mysql.database || 'thesssys_wms_enterprise_db';
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
    database: cfg.mysql.database || 'thesssys_wms_enterprise_db',
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

async function ensureConnected() {
  if (!mysqlPool) {
    const cfg = getDbConfig();
    await connectMySQL(cfg);
  }
}

const dbAsync = {
  async run(sql, params = []) {
    await ensureConnected();
    const cleanParams = params.map(p => (p === undefined ? null : p));
    const [result] = await mysqlPool.execute(sql, cleanParams);
    return { id: result.insertId, changes: result.affectedRows };
  },

  async get(sql, params = []) {
    await ensureConnected();
    const cleanParams = params.map(p => (p === undefined ? null : p));
    const [rows] = await mysqlPool.execute(sql, cleanParams);
    return rows && rows.length > 0 ? rows[0] : null;
  },

  async all(sql, params = []) {
    await ensureConnected();
    const cleanParams = params.map(p => (p === undefined ? null : p));
    const [rows] = await mysqlPool.execute(sql, cleanParams);
    return rows || [];
  },

  async exec(sql) {
    await ensureConnected();
    return await mysqlPool.query(sql);
  }
};

async function initDatabase() {
  const cfg = getDbConfig();
  try {
    await connectMySQL(cfg);
    if (isConnected) {
      await initMySQLSchema();
      await ensureDefaultSeed();
    }
  } catch (err) {
    console.error(`❌ MySQL Database Connection Error: ${err.message}`);
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

  // 19. Return Remarks Master
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS return_remarks_master (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      is_active TINYINT DEFAULT 1,
      warehouse_id INT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 20. Arrange Teams Master
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS arrange_teams_master (
      id INT AUTO_INCREMENT PRIMARY KEY,
      team_code VARCHAR(100) NOT NULL,
      team_name VARCHAR(255) NOT NULL,
      is_active TINYINT DEFAULT 1,
      warehouse_id INT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 21. Returns
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS returns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      return_no VARCHAR(100) UNIQUE NOT NULL,
      ref_invoice_no VARCHAR(100) NULL,
      ref_invoice_date VARCHAR(50) NULL,
      return_date VARCHAR(50) NOT NULL,
      party_code VARCHAR(100) NOT NULL,
      party_name VARCHAR(255) NOT NULL,
      remark_id INT NULL,
      remark_name VARCHAR(255) NULL,
      is_dms_received TINYINT DEFAULT 0,
      str_no VARCHAR(100) NULL,
      status VARCHAR(50) DEFAULT 'Pending DMS',
      total_qty INT DEFAULT 0,
      total_value DECIMAL(15,2) DEFAULT 0,
      internal_remarks TEXT NULL,
      attachment_url TEXT NULL,
      warehouse_id INT NOT NULL,
      created_by VARCHAR(100) DEFAULT 'System',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL,
      INDEX idx_ret_wh (warehouse_id),
      INDEX idx_ret_no (return_no),
      INDEX idx_ret_party (party_code),
      INDEX idx_ret_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  try {
    await dbAsync.exec('ALTER TABLE returns ADD COLUMN ref_invoice_no VARCHAR(100) NULL;');
  } catch (e) {}
  try {
    await dbAsync.exec('ALTER TABLE returns ADD COLUMN ref_invoice_date VARCHAR(50) NULL;');
  } catch (e) {}

  // 22. Return Items
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS return_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      return_id INT NOT NULL,
      part_no VARCHAR(100) NOT NULL,
      part_name VARCHAR(255) NOT NULL,
      reference_invoice_no VARCHAR(100) NULL,
      qty INT NOT NULL DEFAULT 1,
      rate DECIMAL(15,2) DEFAULT 0,
      value DECIMAL(15,2) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
      INDEX idx_ret_items_parent (return_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 23. Arranges
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS arranges (
      id INT AUTO_INCREMENT PRIMARY KEY,
      arrange_no VARCHAR(100) UNIQUE NOT NULL,
      arrange_date VARCHAR(50) NOT NULL,
      sti_no VARCHAR(100) NOT NULL,
      str_no VARCHAR(100) NOT NULL,
      arrange_by_team_id INT NULL,
      arrange_by_team_name VARCHAR(255) NULL,
      arrange_for VARCHAR(50) NOT NULL DEFAULT 'Party',
      destination_code VARCHAR(100) NULL,
      destination_name VARCHAR(255) NULL,
      status VARCHAR(50) DEFAULT 'Created',
      pick_ticket_id INT NULL,
      pick_ticket_no VARCHAR(100) NULL,
      billing_id INT NULL,
      billing_no VARCHAR(100) NULL,
      total_qty INT DEFAULT 0,
      remarks TEXT NULL,
      warehouse_id INT NOT NULL,
      created_by VARCHAR(100) DEFAULT 'System',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL,
      INDEX idx_arr_wh (warehouse_id),
      INDEX idx_arr_no (arrange_no),
      INDEX idx_arr_sti (sti_no),
      INDEX idx_arr_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 24. Arrange Items
  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS arrange_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      arrange_id INT NOT NULL,
      part_no VARCHAR(100) NOT NULL,
      part_name VARCHAR(255) NOT NULL,
      required_qty INT NOT NULL DEFAULT 1,
      available_qty INT DEFAULT 0,
      remarks VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (arrange_id) REFERENCES arranges(id) ON DELETE CASCADE,
      INDEX idx_arr_items_parent (arrange_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
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

    // Safety Migration: Backfill any legacy NULL warehouse_id to default warehouse (id: 1)
    const tablesWithWh = [
      'pick_tickets', 'billings', 'dispatches', 'dispatch_parties',
      'parties', 'route_masters', 'route_schedules', 'picker_checker_helpers',
      'drivers', 'vehicles', 'returns', 'return_items', 'arranges', 'material_arranges',
      'return_remarks_master', 'arrange_teams_master', 'salesman_masters', 'salesmen'
    ];
    for (const tbl of tablesWithWh) {
      try {
        await dbAsync.run(`UPDATE ${tbl} SET warehouse_id = 1 WHERE warehouse_id IS NULL`);
      } catch (e) {}
    }
    const existingReturnRemarks = await dbAsync.get('SELECT id FROM return_remarks_master LIMIT 1');
    if (!existingReturnRemarks) {
      const defaultRemarks = [
        { code: 'RR-01', name: 'Customer Return / Excess Order' },
        { code: 'RR-02', name: 'Damaged in Transit' },
        { code: 'RR-03', name: 'Defective / Quality Issue' },
        { code: 'RR-04', name: 'Wrong Part Dispatched' },
        { code: 'RR-05', name: 'DMS Stock Reconciliation' },
        { code: 'RR-06', name: 'Party Order Cancelled' }
      ];
      for (const r of defaultRemarks) {
        await dbAsync.run(`
          INSERT INTO return_remarks_master (code, name, is_active, warehouse_id)
          VALUES (?, ?, 1, 1)
        `, [r.code, r.name]);
      }
      console.log('✅ Default Return Remarks seeded.');
    }

    // Seed default Arrange Teams if empty
    const existingArrangeTeams = await dbAsync.get('SELECT id FROM arrange_teams_master LIMIT 1');
    if (!existingArrangeTeams) {
      const defaultTeams = [
        { code: 'TM-01', name: 'Team Alpha - Fast Pick' },
        { code: 'TM-02', name: 'Team Bravo - Bulk Arrangement' },
        { code: 'TM-03', name: 'Team Charlie - Retail Fulfillment' },
        { code: 'TM-04', name: 'Team Delta - Stock Replenishment' }
      ];
      for (const t of defaultTeams) {
        await dbAsync.run(`
          INSERT INTO arrange_teams_master (team_code, team_name, is_active, warehouse_id)
          VALUES (?, ?, 1, 1)
        `, [t.code, t.name]);
      }
      console.log('✅ Default Arrange Teams seeded.');
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

