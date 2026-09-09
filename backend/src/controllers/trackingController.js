const { dbAsync } = require('../config/db');

// Memory store for driver GPS live coordinates
const driverLocations = new Map();

async function getActiveTracking(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const activeDispatches = await dbAsync.all(`
      SELECT d.*, drv.name as driver_name, drv.phone as driver_phone, v.vehicle_number
      FROM dispatches d
      LEFT JOIN drivers drv ON d.driver_id = drv.id
      LEFT JOIN vehicles v ON d.vehicle_id = v.id
      WHERE d.warehouse_id = ? AND d.status IN ('In Transit', 'Loading')
    `, [whId]);

    const result = activeDispatches.map(d => {
      const liveLoc = driverLocations.get(d.driver_id) || {
        lat: 28.5355 + (Math.random() * 0.05 - 0.025),
        lng: 77.2680 + (Math.random() * 0.05 - 0.025),
        speed: Math.floor(25 + Math.random() * 30),
        last_updated: new Date().toISOString()
      };

      return {
        ...d,
        location: liveLoc
      };
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching active vehicle tracking.' });
  }
}

async function updateLocation(req, res) {
  try {
    const { driver_id, lat, lng, speed } = req.body;
    if (!driver_id || !lat || !lng) {
      return res.status(400).json({ message: 'Driver ID and coordinates are required.' });
    }

    const locData = {
      driver_id,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      speed: parseFloat(speed || 0),
      last_updated: new Date().toISOString()
    };

    driverLocations.set(driver_id, locData);

    // Broadcast live location over Socket.io
    if (req.io) {
      req.io.emit('driverLocationUpdated', locData);
    }

    return res.json({ message: 'Location updated successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Error updating driver location.' });
  }
}

module.exports = {
  getActiveTracking,
  updateLocation
};
