const { dbAsync } = require('../config/db');

async function getAuditLogs(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const { action_type, module: moduleParam, search, fromDate, toDate } = req.query;

    let query = 'SELECT * FROM audit_logs WHERE (warehouse_id = ? OR warehouse_id IS NULL)';
    const params = [whId];

    if (action_type) {
      query += ' AND action_type = ?';
      params.push(action_type);
    }

    if (moduleParam) {
      query += ' AND module = ?';
      params.push(moduleParam);
    }

    if (fromDate) {
      query += ' AND date(timestamp) >= date(?)';
      params.push(fromDate);
    }

    if (toDate) {
      query += ' AND date(timestamp) <= date(?)';
      params.push(toDate);
    }

    if (search) {
      query += ' AND (target_id LIKE ? OR user_name LIKE ? OR details LIKE ? OR user_ip LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += ' ORDER BY id DESC LIMIT 200';

    const logs = await dbAsync.all(query, params);

    // Summary counts
    const totalLogs = logs.length;
    const totalEdits = logs.filter(l => l.action_type === 'EDIT' || l.action_type === 'STATUS_CHANGE').length;
    const totalDeletes = logs.filter(l => l.action_type === 'DELETE').length;
    const totalExports = logs.filter(l => l.action_type === 'EXPORT').length;

    return res.json({
      summary: {
        totalLogs,
        totalEdits,
        totalDeletes,
        totalExports
      },
      logs
    });
  } catch (err) {
    console.error('getAuditLogs error:', err);
    return res.status(500).json({ message: 'Failed to fetch audit logs.' });
  }
}

module.exports = {
  getAuditLogs
};
