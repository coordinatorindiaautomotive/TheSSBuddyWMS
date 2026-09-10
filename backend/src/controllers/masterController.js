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

// 2. Routes (Route Master) & Route Schedules CRUD
async function getRoutes(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const routes = await dbAsync.all('SELECT * FROM route_masters WHERE warehouse_id = ? ORDER BY route_name ASC', [whId]);
    const schedules = await dbAsync.all('SELECT * FROM route_schedules WHERE warehouse_id = ? ORDER BY priority_order ASC, dispatch_time ASC', [whId]);
    
    const routesWithSchedules = routes.map(r => {
      const rScheds = schedules.filter(s => s.route_id === r.id);
      return {
        ...r,
        schedules: rScheds,
        scheduleCount: rScheds.length,
        activeScheduleCount: rScheds.filter(s => s.is_active).length
      };
    });

    return res.json(routesWithSchedules);
  } catch (err) {
    console.error('Error fetching routes:', err);
    return res.status(500).json({ message: 'Error fetching routes.' });
  }
}

async function createRoute(req, res) {
  try {
    const whId = req.activeWarehouseId;
    let { 
      route_code, 
      route_name,
      morning_enabled,
      morning_cutoff,
      morning_dispatch,
      morning_days,
      evening_enabled,
      evening_cutoff,
      evening_dispatch,
      evening_days,
      selected_days
    } = req.body;

    if (!route_code || route_code.trim() === '') {
      const allRoutes = await dbAsync.all('SELECT route_code, id FROM route_masters');
      let maxNum = 0;
      allRoutes.forEach(r => {
        const c = r.route_code || `RT-${r.id}`;
        const match = String(c).match(/(?:RT|ROUTE)-?(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
      route_code = `RT-${String(maxNum + 1).padStart(2, '0')}`;
    }

    const result = await dbAsync.run(`
      INSERT INTO route_masters (route_code, route_name, warehouse_id)
      VALUES (?, ?, ?)
    `, [route_code, route_name, whId]);

    const routeId = result.id;
    const defaultDays = selected_days ? (typeof selected_days === 'string' ? selected_days : JSON.stringify(selected_days)) : JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);

    // Check if custom morning / evening provided or fallback
    if (morning_enabled !== undefined || evening_enabled !== undefined) {
      if (morning_enabled) {
        const mDays = morning_days ? (typeof morning_days === 'string' ? morning_days : JSON.stringify(morning_days)) : defaultDays;
        await dbAsync.run(`
          INSERT INTO route_schedules (route_id, trip_name, dispatch_type, frequency, selected_days, cutoff_time, dispatch_time, is_active, priority_order, warehouse_id)
          VALUES (?, 'Morning Shift', 'FIXED_TIME', 'WEEKLY_SPECIFIC_DAYS', ?, ?, ?, 1, 1, ?)
        `, [routeId, mDays, morning_cutoff || '08:00', morning_dispatch || '09:30', whId]);
      }
      if (evening_enabled) {
        const eDays = evening_days ? (typeof evening_days === 'string' ? evening_days : JSON.stringify(evening_days)) : defaultDays;
        await dbAsync.run(`
          INSERT INTO route_schedules (route_id, trip_name, dispatch_type, frequency, selected_days, cutoff_time, dispatch_time, is_active, priority_order, warehouse_id)
          VALUES (?, 'Evening Shift', 'FIXED_TIME', 'WEEKLY_SPECIFIC_DAYS', ?, ?, ?, 1, 2, ?)
        `, [routeId, eDays, evening_cutoff || '18:00', evening_dispatch || '19:30', whId]);
      }
    } else {
      // Default initial schedule
      await dbAsync.run(`
        INSERT INTO route_schedules (route_id, trip_name, dispatch_type, frequency, selected_days, cutoff_time, dispatch_time, is_active, priority_order, warehouse_id)
        VALUES (?, 'Morning Shift', 'FIXED_TIME', 'DAILY', ?, '08:00', '09:30', 1, 1, ?)
      `, [routeId, defaultDays, whId]);
    }

    if (req.io) {
      req.io.emit('routeMasterUpdated', { action: 'CREATE', routeId: result.id });
    }

    return res.json({ message: 'Route and dispatch schedules created successfully!', id: result.id });
  } catch (err) {
    console.error('Error creating route:', err);
    return res.status(500).json({ message: 'Error creating route.' });
  }
}

async function updateRoute(req, res) {
  try {
    const { id } = req.params;
    const { 
      route_code, 
      route_name,
      morning_enabled,
      morning_cutoff,
      morning_dispatch,
      morning_days,
      evening_enabled,
      evening_cutoff,
      evening_dispatch,
      evening_days,
      selected_days
    } = req.body;

    const existingRoute = await dbAsync.get('SELECT warehouse_id FROM route_masters WHERE id = ?', [id]);
    const whId = req.activeWarehouseId || existingRoute?.warehouse_id || 1;

    await dbAsync.run(`
      UPDATE route_masters
      SET route_code = ?, route_name = ?
      WHERE id = ?
    `, [route_code, route_name, id]);

    // If morning/evening settings were passed in edit form, update them directly
    if (morning_enabled !== undefined || evening_enabled !== undefined) {
      const defaultDays = selected_days ? (typeof selected_days === 'string' ? selected_days : JSON.stringify(selected_days)) : JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);

      // Remove all previous schedules for this route to cleanly refresh with user's choices
      await dbAsync.run(`
        DELETE FROM route_schedules 
        WHERE route_id = ?
      `, [id]);

      if (morning_enabled) {
        const mDays = morning_days ? (typeof morning_days === 'string' ? morning_days : JSON.stringify(morning_days)) : defaultDays;
        await dbAsync.run(`
          INSERT INTO route_schedules (route_id, trip_name, dispatch_type, frequency, selected_days, cutoff_time, dispatch_time, is_active, priority_order, warehouse_id)
          VALUES (?, 'Morning Shift', 'FIXED_TIME', 'WEEKLY_SPECIFIC_DAYS', ?, ?, ?, 1, 1, ?)
        `, [id, mDays, morning_cutoff || '08:00', morning_dispatch || '09:30', whId]);
      }

      if (evening_enabled) {
        const eDays = evening_days ? (typeof evening_days === 'string' ? evening_days : JSON.stringify(evening_days)) : defaultDays;
        await dbAsync.run(`
          INSERT INTO route_schedules (route_id, trip_name, dispatch_type, frequency, selected_days, cutoff_time, dispatch_time, is_active, priority_order, warehouse_id)
          VALUES (?, 'Evening Shift', 'FIXED_TIME', 'WEEKLY_SPECIFIC_DAYS', ?, ?, ?, 1, 2, ?)
        `, [id, eDays, evening_cutoff || '18:00', evening_dispatch || '19:30', whId]);
      }
    }

    if (req.io) {
      req.io.emit('routeMasterUpdated', { action: 'UPDATE', routeId: id });
    }

    return res.json({ message: 'Route updated successfully!' });
  } catch (err) {
    console.error('Error updating route:', err);
    return res.status(500).json({ message: 'Error updating route.' });
  }
}

async function deleteRoute(req, res) {
  try {
    const { id } = req.params;
    await dbAsync.run('DELETE FROM route_schedules WHERE route_id = ?', [id]);
    await dbAsync.run('DELETE FROM route_masters WHERE id = ?', [id]);

    if (req.io) {
      req.io.emit('routeMasterUpdated', { action: 'DELETE', routeId: id });
    }

    return res.json({ message: 'Route and its schedules deleted successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Error deleting route.' });
  }
}

// 2b. Route Schedules Sub-Master
async function getRouteSchedules(req, res) {
  try {
    const routeId = req.params.routeId || req.query.route_id;
    const whId = req.activeWarehouseId;
    const schedules = await dbAsync.all(`
      SELECT * FROM route_schedules 
      WHERE route_id = ? ${whId ? 'AND (warehouse_id = ? OR warehouse_id IS NULL)' : ''} 
      ORDER BY priority_order ASC, dispatch_time ASC
    `, whId ? [routeId, whId] : [routeId]);
    return res.json(schedules);
  } catch (err) {
    console.error('Error fetching route schedules:', err);
    return res.status(500).json({ message: 'Error fetching route schedules.' });
  }
}

async function createRouteSchedule(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const route_id = req.params.routeId || req.body.route_id || req.body.routeId;
    const { trip_name, dispatch_type, frequency, selected_days, cutoff_time, dispatch_time, is_active, priority_order } = req.body;

    if (!route_id) {
      return res.status(400).json({ message: 'Route ID is required to create a schedule.' });
    }

    const daysStr = typeof selected_days === 'object' ? JSON.stringify(selected_days) : (selected_days || '["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]');

    const result = await dbAsync.run(`
      INSERT INTO route_schedules (route_id, trip_name, dispatch_type, frequency, selected_days, cutoff_time, dispatch_time, is_active, priority_order, warehouse_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      route_id,
      trip_name || 'Trip',
      dispatch_type || 'FIXED_TIME',
      frequency || 'DAILY',
      daysStr,
      cutoff_time || '08:00',
      dispatch_time || '09:30',
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      priority_order || 1,
      whId
    ]);

    await dbAsync.run(`
      INSERT INTO audit_logs (warehouse_id, user_name, user_role, action_type, module, target_id, details)
      VALUES (?, ?, ?, 'CREATE', 'ROUTE_SCHEDULE', ?, ?)
    `, [whId, req.user?.full_name || 'Admin', req.user?.role || 'Admin', String(result.id), `Added trip schedule '${trip_name}' for Route ID ${route_id}`]);

    if (req.io) {
      req.io.emit('routeScheduleUpdated', { route_id, schedule_id: result.id, action: 'CREATE' });
    }

    return res.json({ message: 'Route schedule created successfully!', id: result.id });
  } catch (err) {
    console.error('Error creating route schedule:', err);
    return res.status(500).json({ message: 'Error creating route schedule: ' + err.message });
  }
}

async function updateRouteSchedule(req, res) {
  try {
    const scheduleId = req.params.scheduleId || req.params.id;
    const whId = req.activeWarehouseId || 1;
    const { trip_name, dispatch_type, frequency, selected_days, cutoff_time, dispatch_time, is_active, priority_order } = req.body;

    const daysStr = typeof selected_days === 'object' ? JSON.stringify(selected_days) : (selected_days || '["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]');

    const oldSchedule = await dbAsync.get('SELECT * FROM route_schedules WHERE id = ?', [scheduleId]);

    await dbAsync.run(`
      UPDATE route_schedules
      SET trip_name = ?, dispatch_type = ?, frequency = ?, selected_days = ?, cutoff_time = ?, dispatch_time = ?, is_active = ?, priority_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      trip_name,
      dispatch_type || 'FIXED_TIME',
      frequency || 'DAILY',
      daysStr,
      cutoff_time || '',
      dispatch_time || '',
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      priority_order || 1,
      scheduleId
    ]);

    // Audit Log old vs new
    const details = `Updated trip '${trip_name}' - Cutoff: ${oldSchedule?.cutoff_time || ''}->${cutoff_time}, Dispatch: ${oldSchedule?.dispatch_time || ''}->${dispatch_time}`;
    await dbAsync.run(`
      INSERT INTO audit_logs (warehouse_id, user_name, user_role, action_type, module, target_id, details)
      VALUES (?, ?, ?, 'UPDATE', 'ROUTE_SCHEDULE', ?, ?)
    `, [whId, req.user?.full_name || 'Admin', req.user?.role || 'Admin', String(scheduleId), details]);

    if (req.io) {
      req.io.emit('routeScheduleUpdated', { schedule_id: scheduleId, route_id: oldSchedule?.route_id, action: 'UPDATE' });
    }

    return res.json({ message: 'Route schedule updated successfully!' });
  } catch (err) {
    console.error('Error updating route schedule:', err);
    return res.status(500).json({ message: 'Error updating route schedule: ' + err.message });
  }
}

async function deleteRouteSchedule(req, res) {
  try {
    const scheduleId = req.params.scheduleId || req.params.id;
    const whId = req.activeWarehouseId || 1;
    const sched = await dbAsync.get('SELECT * FROM route_schedules WHERE id = ?', [scheduleId]);
    await dbAsync.run('DELETE FROM route_schedules WHERE id = ?', [scheduleId]);

    await dbAsync.run(`
      INSERT INTO audit_logs (warehouse_id, user_name, user_role, action_type, module, target_id, details)
      VALUES (?, ?, ?, 'DELETE', 'ROUTE_SCHEDULE', ?, ?)
    `, [whId, req.user?.full_name || 'Admin', req.user?.role || 'Admin', String(scheduleId), `Deleted trip schedule '${sched?.trip_name}'`]);

    if (req.io) {
      req.io.emit('routeScheduleUpdated', { schedule_id: scheduleId, route_id: sched?.route_id, action: 'DELETE' });
    }

    return res.json({ message: 'Route schedule deleted successfully!' });
  } catch (err) {
    console.error('Error deleting route schedule:', err);
    return res.status(500).json({ message: 'Error deleting route schedule.' });
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
    const whId = req.activeWarehouseId || 1;
    let salesmen = [];
    try {
      salesmen = await dbAsync.all(`
        SELECT id, salesman_code, salesman_name as name, salesman_name, phone, mobile, territory, warehouse_id
        FROM salesman_masters 
        WHERE warehouse_id = ? OR warehouse_id IS NULL
        ORDER BY salesman_name ASC
      `, [whId]);
    } catch (e) {}

    if (!salesmen || salesmen.length === 0) {
      try {
        salesmen = await dbAsync.all(`
          SELECT id, salesman_code, name, name as salesman_name, phone, territory, warehouse_id
          FROM salesmen 
          WHERE warehouse_id = ? OR warehouse_id IS NULL
          ORDER BY name ASC
        `, [whId]);
      } catch (e) {
        salesmen = await dbAsync.all('SELECT id, salesman_code, name, name as salesman_name, phone, territory FROM salesmen ORDER BY name ASC');
      }
    }

    return res.json(salesmen || []);
  } catch (err) {
    console.error('Error fetching salesmen:', err);
    return res.status(500).json({ message: 'Error fetching salesmen.' });
  }
}

async function createSalesman(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const { salesman_code, name, salesman_name, phone, territory } = req.body;
    const sName = (salesman_name || name || '').trim();

    if (!sName) {
      return res.status(400).json({ message: 'Salesman name is required.' });
    }

    const code = salesman_code || ('SM-' + sName.replace(/[^A-Za-z0-9]/g, '').substring(0, 8).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900));

    let insertId = null;

    // 1. Insert into salesman_masters
    try {
      const res1 = await dbAsync.run(`
        INSERT INTO salesman_masters (salesman_code, salesman_name, phone, territory, warehouse_id)
        VALUES (?, ?, ?, ?, ?)
      `, [code, sName, phone || '', territory || 'General Territory', whId]);
      insertId = res1.id;
    } catch (err1) {
      console.warn('Could not insert into salesman_masters, trying salesmen table:', err1.message);
    }

    // 2. Insert into salesmen table
    try {
      const res2 = await dbAsync.run(`
        INSERT INTO salesmen (salesman_code, name, phone, territory, warehouse_id)
        VALUES (?, ?, ?, ?, ?)
      `, [code, sName, phone || '', territory || 'General Territory', whId]);
      if (!insertId) insertId = res2.id;
    } catch (err2) {
      try {
        const res3 = await dbAsync.run(`
          INSERT INTO salesmen (salesman_code, name, phone, territory)
          VALUES (?, ?, ?, ?)
        `, [code, sName, phone || '', territory || 'General Territory']);
        if (!insertId) insertId = res3.id;
      } catch (err3) {}
    }

    return res.json({ message: 'Salesman registered successfully!', id: insertId || Date.now(), name: sName, salesman_code: code });
  } catch (err) {
    console.error('Error creating salesman:', err);
    return res.status(500).json({ message: 'Error creating salesman: ' + err.message });
  }
}

async function updateSalesman(req, res) {
  try {
    const { id } = req.params;
    const { salesman_code, name, salesman_name, phone, territory } = req.body;
    const sName = (salesman_name || name || '').trim();

    try {
      await dbAsync.run(`
        UPDATE salesman_masters
        SET salesman_name = ?, phone = ?, territory = ?
        WHERE id = ? OR salesman_code = ?
      `, [sName || name, phone || '', territory || '', id, salesman_code || '']);
    } catch (e) {}

    try {
      await dbAsync.run(`
        UPDATE salesmen
        SET name = ?, phone = ?, territory = ?
        WHERE id = ? OR salesman_code = ?
      `, [sName || name, phone || '', territory || '', id, salesman_code || '']);
    } catch (e) {}

    return res.json({ message: 'Salesman updated successfully!' });
  } catch (err) {
    console.error('Error updating salesman:', err);
    return res.status(500).json({ message: 'Error updating salesman: ' + err.message });
  }
}

async function deleteSalesman(req, res) {
  try {
    const { id } = req.params;
    try {
      await dbAsync.run('DELETE FROM salesman_masters WHERE id = ?', [id]);
    } catch (e) {}
    try {
      await dbAsync.run('DELETE FROM salesmen WHERE id = ?', [id]);
    } catch (e) {}

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
  getRouteSchedules,
  createRouteSchedule,
  updateRouteSchedule,
  deleteRouteSchedule,

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
