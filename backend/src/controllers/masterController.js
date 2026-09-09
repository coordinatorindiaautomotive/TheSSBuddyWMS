const bcrypt = require('bcryptjs');
const { dbAsync } = require('../config/db');

// 1. Warehouses CRUD
async function getWarehouses(req, res) {
  try {
    const warehouses = await dbAsync.all('SELECT * FROM warehouses ORDER BY warehouse_name ASC');
    return res.json(warehouses);
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching warehouses.' });
  }
}

async function createWarehouse(req, res) {
  try {
    const { warehouse_code, warehouse_name, address, contact_number, prefix_logic } = req.body;
    const result = await dbAsync.run(`
      INSERT INTO warehouses (warehouse_code, warehouse_name, address, contact_number, prefix_logic, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [warehouse_code, warehouse_name, address || '', contact_number || '', prefix_logic || 'PIK26-']);
    return res.json({ message: 'Warehouse created successfully!', id: result.id });
  } catch (err) {
    return res.status(500).json({ message: 'Error creating warehouse.' });
  }
}

async function updateWarehouse(req, res) {
  try {
    const { id } = req.params;
    const { warehouse_code, warehouse_name, address, contact_number, prefix_logic } = req.body;
    await dbAsync.run(`
      UPDATE warehouses
      SET warehouse_code = ?, warehouse_name = ?, address = ?, contact_number = ?, prefix_logic = ?
      WHERE id = ?
    `, [warehouse_code, warehouse_name, address || '', contact_number || '', prefix_logic || 'PIK26-', id]);
    return res.json({ message: 'Warehouse updated successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Error updating warehouse.' });
  }
}

async function deleteWarehouse(req, res) {
  try {
    const { id } = req.params;
    await dbAsync.run('DELETE FROM warehouses WHERE id = ?', [id]);
    return res.json({ message: 'Warehouse deleted successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Error deleting warehouse.' });
  }
}

// 2. Routes (Route Master) CRUD
async function getRoutes(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const routes = await dbAsync.all('SELECT * FROM route_masters WHERE warehouse_id = ? ORDER BY route_name ASC', [whId]);
    return res.json(routes);
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching routes.' });
  }
}

async function createRoute(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const { route_code, route_name } = req.body;
    const result = await dbAsync.run(`
      INSERT INTO route_masters (route_code, route_name, warehouse_id)
      VALUES (?, ?, ?)
    `, [route_code, route_name, whId]);
    return res.json({ message: 'Route created successfully!', id: result.id });
  } catch (err) {
    return res.status(500).json({ message: 'Error creating route.' });
  }
}

async function updateRoute(req, res) {
  try {
    const { id } = req.params;
    const { route_code, route_name } = req.body;
    await dbAsync.run(`
      UPDATE route_masters
      SET route_code = ?, route_name = ?
      WHERE id = ?
    `, [route_code, route_name, id]);
    return res.json({ message: 'Route updated successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Error updating route.' });
  }
}

async function deleteRoute(req, res) {
  try {
    const { id } = req.params;
    await dbAsync.run('DELETE FROM route_masters WHERE id = ?', [id]);
    return res.json({ message: 'Route deleted successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Error deleting route.' });
  }
}

// 3. Workers CRUD
async function getWorkers(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const workers = await dbAsync.all('SELECT * FROM picker_checker_helpers WHERE warehouse_id = ? ORDER BY name ASC', [whId]);
    return res.json(workers);
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching workers.' });
  }
}

async function createWorker(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const { name, role, phone, employee_code } = req.body;

    let empCode = employee_code;
    if (!empCode) {
      const allWorkers = await dbAsync.all('SELECT employee_code, id FROM picker_checker_helpers');
      let maxNum = 0;
      allWorkers.forEach(w => {
        const c = w.employee_code || `EMP-${w.id}`;
        const match = c.match(/EMP-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
      empCode = `EMP-${maxNum + 1}`;
    }

    const result = await dbAsync.run(`
      INSERT INTO picker_checker_helpers (employee_code, name, role, phone, warehouse_id, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [empCode, name, role, phone || '', whId]);
    return res.json({ message: 'Worker added successfully!', id: result.id, employee_code: empCode });
  } catch (err) {
    return res.status(500).json({ message: 'Error creating worker.' });
  }
}

async function updateWorker(req, res) {
  try {
    const { id } = req.params;
    const { name, role, phone, employee_code } = req.body;
    await dbAsync.run(`
      UPDATE picker_checker_helpers
      SET employee_code = ?, name = ?, role = ?, phone = ?
      WHERE id = ?
    `, [employee_code, name, role, phone || '', id]);
    return res.json({ message: 'Worker updated successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Error updating worker.' });
  }
}

async function deleteWorker(req, res) {
  try {
    const { id } = req.params;
    await dbAsync.run('DELETE FROM picker_checker_helpers WHERE id = ?', [id]);
    return res.json({ message: 'Worker deleted successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Error deleting worker.' });
  }
}

// 4. Salesmen CRUD
async function getSalesmen(req, res) {
  try {
    const salesmen = await dbAsync.all('SELECT * FROM salesmen ORDER BY name ASC');
    return res.json(salesmen);
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching salesmen.' });
  }
}

async function createSalesman(req, res) {
  try {
    const { salesman_code, name, phone, territory } = req.body;
    const code = salesman_code || `SLS-${Math.floor(100 + Math.random() * 900)}`;
    const result = await dbAsync.run(`
      INSERT INTO salesmen (salesman_code, name, phone, territory)
      VALUES (?, ?, ?, ?)
    `, [code, name, phone || '', territory || 'General Territory']);
    return res.json({ message: 'Salesman registered successfully!', id: result.id });
  } catch (err) {
    return res.status(500).json({ message: 'Error creating salesman.' });
  }
}

async function updateSalesman(req, res) {
  try {
    const { id } = req.params;
    const { salesman_code, name, phone, territory } = req.body;
    await dbAsync.run(`
      UPDATE salesmen
      SET salesman_code = ?, name = ?, phone = ?, territory = ?
      WHERE id = ?
    `, [salesman_code, name, phone || '', territory || '', id]);
    return res.json({ message: 'Salesman updated successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Error updating salesman.' });
  }
}

async function deleteSalesman(req, res) {
  try {
    const { id } = req.params;
    await dbAsync.run('DELETE FROM salesmen WHERE id = ?', [id]);
    return res.json({ message: 'Salesman deleted successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Error deleting salesman.' });
  }
}

// 5. Drivers CRUD
async function getDrivers(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const drivers = await dbAsync.all('SELECT * FROM drivers WHERE warehouse_id = ? ORDER BY name ASC', [whId]);
    return res.json(drivers);
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching drivers.' });
  }
}

async function createDriver(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const { name, phone, license_no } = req.body;
    const result = await dbAsync.run(`
      INSERT INTO drivers (name, phone, license_no, status, warehouse_id)
      VALUES (?, ?, ?, 'Available', ?)
    `, [name, phone, license_no || '', whId]);

    const passwordHash = await bcrypt.hash('driver123', 10);
    const username = `driver_${phone.replace(/\D/g, '').slice(-4)}`;
    const existingUser = await dbAsync.get('SELECT id FROM users WHERE username = ?', [username]);
    if (!existingUser) {
      await dbAsync.run(`
        INSERT INTO users (username, email, password_hash, full_name, role, warehouse_id)
        VALUES (?, ?, ?, ?, 'Driver', ?)
      `, [username, `${username}@thessbuddy.com`, passwordHash, name, whId]);
    }

    return res.json({ message: 'Driver registered successfully!', id: result.id });
  } catch (err) {
    return res.status(500).json({ message: 'Error creating driver.' });
  }
}

async function updateDriver(req, res) {
  try {
    const { id } = req.params;
    const { name, phone, license_no, status } = req.body;
    await dbAsync.run(`
      UPDATE drivers
      SET name = ?, phone = ?, license_no = ?, status = ?
      WHERE id = ?
    `, [name, phone, license_no || '', status || 'Available', id]);
    return res.json({ message: 'Driver updated successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Error updating driver.' });
  }
}

async function deleteDriver(req, res) {
  try {
    const { id } = req.params;
    await dbAsync.run('DELETE FROM drivers WHERE id = ?', [id]);
    return res.json({ message: 'Driver deleted successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Error deleting driver.' });
  }
}

// 6. Vehicles CRUD
async function getVehicles(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const vehicles = await dbAsync.all(`
      SELECT v.*, d.name as driver_name
      FROM vehicles v
      LEFT JOIN drivers d ON v.driver_id = d.id
      WHERE v.warehouse_id = ?
      ORDER BY v.vehicle_number ASC
    `, [whId]);
    return res.json(vehicles);
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching vehicles.' });
  }
}

async function createVehicle(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const { vehicle_number, driver_id, capacity_tons } = req.body;
    const result = await dbAsync.run(`
      INSERT INTO vehicles (vehicle_number, driver_id, capacity_tons, status, warehouse_id)
      VALUES (?, ?, ?, 'Available', ?)
    `, [vehicle_number, driver_id || null, parseFloat(capacity_tons || 5.0), whId]);

    return res.json({ message: 'Vehicle added successfully!', id: result.id });
  } catch (err) {
    return res.status(500).json({ message: 'Error creating vehicle.' });
  }
}

async function updateVehicle(req, res) {
  try {
    const { id } = req.params;
    const { vehicle_number, driver_id, capacity_tons, status } = req.body;
    await dbAsync.run(`
      UPDATE vehicles
      SET vehicle_number = ?, driver_id = ?, capacity_tons = ?, status = ?
      WHERE id = ?
    `, [vehicle_number, driver_id || null, parseFloat(capacity_tons || 5.0), status || 'Available', id]);
    return res.json({ message: 'Vehicle updated successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Error updating vehicle.' });
  }
}

async function deleteVehicle(req, res) {
  try {
    const { id } = req.params;
    await dbAsync.run('DELETE FROM vehicles WHERE id = ?', [id]);
    return res.json({ message: 'Vehicle deleted successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Error deleting vehicle.' });
  }
}

// 7. Users CRUD
async function getUsers(req, res) {
  try {
    const users = await dbAsync.all(`
      SELECT u.id, u.username, u.email, u.full_name, COALESCE(u.role, 'Operator') as role_name, u.is_active, u.created_at, w.warehouse_name
      FROM users u
      LEFT JOIN warehouses w ON u.warehouse_id = w.id
      ORDER BY u.full_name ASC
    `);
    return res.json(users);
  } catch (err) {
    console.error('getUsers error:', err);
    return res.status(500).json({ message: 'Error fetching users.' });
  }
}

async function createUser(req, res) {
  try {
    const { username, email, password, full_name, role_name, role, warehouse_id, is_active } = req.body;
    const finalRole = role_name || role || 'Operator';
    const cleanEmail = (email && email.trim()) ? email.trim() : null;
    const finalUsername = (username && username.trim()) ? username.trim() : (cleanEmail || `user_${Date.now()}`);
    const passwordHash = await bcrypt.hash(password || 'user123', 10);
    const activeVal = is_active !== undefined ? (is_active ? 1 : 0) : 1;
    const whId = (warehouse_id && warehouse_id !== '') ? parseInt(warehouse_id, 10) : null;

    const result = await dbAsync.run(`
      INSERT INTO users (username, email, password_hash, full_name, role, warehouse_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [finalUsername, cleanEmail, passwordHash, full_name || finalUsername, finalRole, whId, activeVal]);

    return res.json({ message: 'User account created successfully!', id: result.id });
  } catch (err) {
    console.error('createUser error:', err);
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ message: 'A user account with this Email or Username already exists.' });
    }
    return res.status(500).json({ message: err.message || 'Error creating user account.' });
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { username, email, full_name, role_name, role, warehouse_id, is_active, password } = req.body;

    const existing = await dbAsync.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ message: 'User not found.' });

    const finalRole = role_name || role || existing.role || 'Operator';
    const activeVal = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;
    const cleanEmail = (email !== undefined) ? ((email && email.trim()) ? email.trim() : null) : existing.email;
    const finalUsername = (username && username.trim()) ? username.trim() : (cleanEmail || existing.username);
    const whId = (warehouse_id !== undefined) ? ((warehouse_id && warehouse_id !== '') ? parseInt(warehouse_id, 10) : null) : existing.warehouse_id;

    let passwordHash = existing.password_hash;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    await dbAsync.run(`
      UPDATE users
      SET username = ?, email = ?, full_name = ?, role = ?, warehouse_id = ?, is_active = ?, password_hash = ?
      WHERE id = ?
    `, [
      finalUsername,
      cleanEmail,
      full_name || existing.full_name,
      finalRole,
      whId,
      activeVal,
      passwordHash,
      id
    ]);

    return res.json({ message: 'User account updated successfully!' });
  } catch (err) {
    console.error('updateUser error:', err);
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ message: 'A user account with this Email or Username already exists.' });
    }
    return res.status(500).json({ message: err.message || 'Error updating user.' });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    await dbAsync.run('DELETE FROM users WHERE id = ?', [id]);
    return res.json({ message: 'User deleted successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Error deleting user.' });
  }
}

module.exports = {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,

  getRoutes,
  createRoute,
  updateRoute,
  deleteRoute,

  getWorkers,
  createWorker,
  updateWorker,
  deleteWorker,

  getSalesmen,
  createSalesman,
  updateSalesman,
  deleteSalesman,

  getDrivers,
  createDriver,
  updateDriver,
  deleteDriver,

  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,

  getUsers,
  createUser,
  updateUser,
  deleteUser
};
