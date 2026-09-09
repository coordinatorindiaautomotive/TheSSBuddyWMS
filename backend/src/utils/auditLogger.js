const { dbAsync } = require('../config/db');

/**
 * Granular Audit Logger Utility
 * Records every single create, edit, delete, status change, export, or login event.
 */
async function logAudit(req, { action_type, module, target_id, details, changed_fields = null }) {
  try {
    const user = req?.user || {};
    const userId = user.id || null;
    const userName = user.full_name || user.username || 'System User';
    const userRole = user.role || 'Operator';
    
    let userIp = '127.0.0.1';
    if (req) {
      userIp = req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '127.0.0.1';
      if (userIp.includes('::ffff:')) {
        userIp = userIp.replace('::ffff:', '');
      }
    }

    const warehouseId = req?.activeWarehouseId || user.warehouse_id || 1;
    const fieldsJson = changed_fields ? JSON.stringify(changed_fields) : null;

    await dbAsync.run(`
      INSERT INTO audit_logs (
        warehouse_id, user_id, user_name, user_role, user_ip,
        action_type, module, target_id, details, changed_fields, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      warehouseId,
      userId,
      userName,
      userRole,
      userIp,
      action_type,
      module,
      target_id || 'N/A',
      details || '',
      fieldsJson
    ]);
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
}

module.exports = {
  logAudit
};
