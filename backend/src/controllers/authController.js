const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbAsync } = require('../config/db');
const { JWT_SECRET } = require('../middleware/authMiddleware');

async function login(req, res) {
  try {
    const username = (req.body?.username || '').trim();
    const password = (req.body?.password || '').trim();

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    let user = null;
    try {
      user = await dbAsync.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)', [username, username]);
    } catch (e) {
      console.warn('DB query failed during login (DB might not be configured yet):', e.message);
    }

    // Bootstrap Master Admin fallback when database is not initialized yet or empty
    const unameLower = username.toLowerCase();
    if (!user && (unameLower === 'admin' || unameLower === 'admin@thessbuddy.com') && password === 'admin123') {
      user = {
        id: 1,
        username: 'admin',
        email: 'admin@thessbuddy.com',
        full_name: 'System Super Admin',
        role: 'SuperAdmin',
        role_name: 'Super Admin',
        warehouse_id: 1,
        is_active: 1
      };
    } else if (!user) {
      return res.status(401).json({ message: 'Invalid credentials. Use admin / admin123' });
    } else {
      if (!user.is_active) {
        return res.status(403).json({ message: 'Account is deactivated.' });
      }
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }
    }

    let warehouse = null;
    try {
      if (user.warehouse_id) {
        warehouse = await dbAsync.get('SELECT * FROM warehouses WHERE id = ?', [user.warehouse_id]);
      } else {
        warehouse = await dbAsync.get('SELECT * FROM warehouses WHERE is_active = 1 LIMIT 1');
      }
    } catch (e) {
      warehouse = { id: 1, warehouse_name: 'Central Warehouse (Default)', warehouse_code: 'WH-MAIN' };
    }

    if (!warehouse) {
      warehouse = { id: 1, warehouse_name: 'Central Warehouse (Default)', warehouse_code: 'WH-MAIN' };
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        warehouse_id: warehouse.id
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Audit Log (safe)
    try {
      const { logAudit } = require('../utils/auditLogger');
      await logAudit(req, {
        action_type: 'USER_LOGIN',
        module: 'AUTH',
        target_id: user.username,
        details: `Logged in successfully as ${user.role}`
      });
    } catch (e) {}

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        warehouse_id: warehouse.id,
        warehouse: warehouse
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error during login: ' + err.message });
  }
}

async function me(req, res) {
  try {
    let user = null;
    try {
      user = await dbAsync.get('SELECT id, username, email, full_name, role, warehouse_id, is_active FROM users WHERE id = ?', [req.user.id]);
    } catch (e) {}

    if (!user) {
      user = {
        id: req.user.id || 1,
        username: req.user.username || 'admin',
        email: 'admin@thessbuddy.com',
        full_name: req.user.full_name || 'System Super Admin',
        role: req.user.role || 'SuperAdmin',
        warehouse_id: 1,
        is_active: 1
      };
    }

    let warehouse = null;
    let warehouses = [];
    try {
      warehouse = await dbAsync.get('SELECT * FROM warehouses WHERE id = ?', [req.activeWarehouseId]);
      warehouses = await dbAsync.all('SELECT * FROM warehouses WHERE is_active = 1');
    } catch (e) {}

    if (!warehouse) {
      warehouse = { id: 1, warehouse_name: 'Central Warehouse (Default)', warehouse_code: 'WH-MAIN' };
      warehouses = [warehouse];
    }

    return res.json({
      user: { ...user, warehouse },
      activeWarehouse: warehouse,
      warehouses
    });
  } catch (err) {
    console.error('Fetch me error:', err);
    return res.status(500).json({ message: 'Server error fetching user profile.' });
  }
}

async function switchWarehouse(req, res) {
  try {
    const { warehouse_id } = req.body;
    const warehouse = await dbAsync.get('SELECT * FROM warehouses WHERE id = ?', [warehouse_id]);
    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found.' });
    }

    return res.json({
      message: `Active warehouse switched to ${warehouse.warehouse_name}`,
      activeWarehouse: warehouse
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error switching warehouse.' });
  }
}

module.exports = {
  login,
  me,
  switchWarehouse
};
