const { getConfig, saveConfig, testConnection } = require('../config/dbConfigManager');
const { initDatabase, dbAsync } = require('../config/db');

async function getSystemConfig(req, res) {
  try {
    const cfg = getConfig();
    const testRes = await testConnection(cfg);
    return res.json({
      config: cfg,
      connectionStatus: testRes
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error getting system config.' });
  }
}

async function updateSystemConfig(req, res) {
  try {
    const { dbType, mssql, sqlite, mysql, postgres } = req.body;
    const currentCfg = getConfig();

    const newCfg = {
      ...currentCfg,
      dbType: dbType || currentCfg.dbType,
      sqlite: sqlite || currentCfg.sqlite,
      mssql: mssql || currentCfg.mssql,
      mysql: mysql || currentCfg.mysql,
      postgres: postgres || currentCfg.postgres
    };

    saveConfig(newCfg);
    const testRes = await testConnection(newCfg);

    return res.json({
      message: 'System database configuration saved successfully!',
      config: newCfg,
      connectionStatus: testRes
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update system config.' });
  }
}

async function testDatabaseConnection(req, res) {
  try {
    const result = await testConnection(req.body);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function autoSyncDatabase(req, res) {
  try {
    await initDatabase();

    // Verify record counts
    const warehouseCount = await dbAsync.get('SELECT COUNT(*) as c FROM warehouses');
    const partyCount = await dbAsync.get('SELECT COUNT(*) as c FROM parties');
    const ticketCount = await dbAsync.get('SELECT COUNT(*) as c FROM pick_tickets');
    const billingCount = await dbAsync.get('SELECT COUNT(*) as c FROM billings');
    const auditCount = await dbAsync.get('SELECT COUNT(*) as c FROM audit_logs');

    return res.json({
      success: true,
      message: '1-Click Database Auto-Sync & Table Migration Completed Successfully!',
      details: {
        warehouses: warehouseCount.c,
        parties: partyCount.c,
        pickTickets: ticketCount.c,
        billings: billingCount.c,
        auditLogs: auditCount.c
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: `Auto Sync Failed: ${err.message}` });
  }
}

module.exports = {
  getSystemConfig,
  updateSystemConfig,
  testDatabaseConnection,
  autoSyncDatabase
};
