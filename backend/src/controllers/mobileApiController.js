const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbAsync } = require('../config/db');
const { JWT_SECRET } = require('../middleware/authMiddleware');

async function mobileLogin(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username/Phone and password required.' });
    }

    const user = await dbAsync.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const driver = await dbAsync.get('SELECT * FROM drivers WHERE phone = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1', [user.username, user.full_name || '']);

    const token = jwt.sign(
      {
        id: user.id,
        driver_id: driver ? driver.id : null,
        username: user.username,
        role: user.role,
        warehouse_id: user.warehouse_id || 1
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      driver: driver || { id: 1, name: user.full_name },
      warehouse_id: user.warehouse_id || 1
    });
  } catch (err) {
    return res.status(500).json({ message: 'Mobile auth failed.' });
  }
}

async function getAssignedDispatches(req, res) {
  try {
    const driverId = req.user.driver_id || 1;
    const dispatches = await dbAsync.all(`
      SELECT d.*, v.vehicle_number
      FROM dispatches d
      LEFT JOIN vehicles v ON d.vehicle_id = v.id
      WHERE d.driver_id = ? AND d.status IN ('Created', 'Loading', 'In Transit')
    `, [driverId]);

    return res.json(dispatches);
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching assigned dispatches.' });
  }
}

module.exports = {
  mobileLogin,
  getAssignedDispatches
};
