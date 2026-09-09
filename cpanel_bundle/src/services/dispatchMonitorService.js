const { dbAsync } = require('../config/db');

function startDispatchMonitor(io) {
  console.log('Starting Dispatch SLA Monitor Background Service...');

  setInterval(async () => {
    try {
      // Find dispatches in loading for over 2 hours or in-transit over 6 hours
      const activeDispatches = await dbAsync.all(`
        SELECT d.*, drv.name as driver_name, v.vehicle_number
        FROM dispatches d
        LEFT JOIN drivers drv ON d.driver_id = drv.id
        LEFT JOIN vehicles v ON d.vehicle_id = v.id
        WHERE d.status IN ('Loading', 'In Transit')
      `, []);

      for (const d of activeDispatches) {
        const started = new Date(d.created_at || Date.now()).getTime();
        const durationHours = (Date.now() - started) / (1000 * 60 * 60);

        if (d.status === 'Loading' && durationHours > 2) {
          const alertMsg = `SLA Warning: Dispatch ${d.dispatch_no} on ${d.vehicle_number} has been in Loading status for ${durationHours.toFixed(1)} hours.`;
          
          await dbAsync.run(`
            INSERT INTO notifications (message, type, warehouse_id)
            VALUES (?, 'Warning', ?)
          `, [alertMsg, d.warehouse_id]);

          if (io) {
            io.emit('slaAlert', { dispatch_no: d.dispatch_no, message: alertMsg });
          }
        }
      }
    } catch (err) {
      console.error('Dispatch SLA Monitor error:', err);
    }
  }, 60000);
}

module.exports = {
  startDispatchMonitor
};
