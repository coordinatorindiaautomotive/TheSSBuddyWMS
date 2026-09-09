const { dbAsync } = require('../config/db');

async function getStats(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;

    const whCondition = 'WHERE warehouse_id = ?';
    const whParams = [whId];

    const ptWhCondition = 'WHERE pt.warehouse_id = ?';
    const ptWhParams = [whId];

    // 1. Core KPIs (Isolated by active warehouse)
    const totalPickTickets = await dbAsync.get(`SELECT COUNT(*) as count FROM pick_tickets ${whCondition}`, whParams);
    
    const pendingPicking = await dbAsync.get(
      `SELECT COUNT(*) as count FROM pick_tickets ${whCondition} AND status IN ('Created', 'Assigned', 'Pending')`,
      whParams
    );

    const pickedTickets = await dbAsync.get(
      `SELECT COUNT(*) as count FROM pick_tickets ${whCondition} AND status = 'Picked'`,
      whParams
    );
    
    const totalBillings = await dbAsync.get(`SELECT COUNT(*) as count FROM billings ${whCondition}`, whParams);

    const pendingBilling = await dbAsync.get(`
      SELECT COUNT(*) as count 
      FROM pick_tickets pt 
      LEFT JOIN billings b ON pt.id = b.pick_ticket_id 
      ${ptWhCondition} AND b.id IS NULL AND pt.status IN ('Picked', 'Created', 'Assigned')
    `, ptWhParams);

    const dispatchedOrders = await dbAsync.get(`
      SELECT COUNT(*) as count 
      FROM pick_tickets 
      ${whCondition} AND status IN ('Dispatched', 'Delivered')
    `, whParams);

    const billedAmount = await dbAsync.get(`SELECT COALESCE(SUM(invoice_amount), 0) as total FROM billings ${whCondition}`, whParams);
    const activeDrivers = await dbAsync.get(`SELECT COUNT(*) as count FROM drivers ${whCondition}`, whParams);
    const totalVehicles = await dbAsync.get(`SELECT COUNT(*) as count FROM vehicles ${whCondition}`, whParams);

    // 2. Route Breakdown (Isolated by active warehouse)
    const routeBreakdown = await dbAsync.all(`
      SELECT 
        route, 
        COUNT(*) as total_tickets,
        SUM(CASE WHEN status IN ('Dispatched', 'Delivered') THEN 1 ELSE 0 END) as dispatched_tickets,
        SUM(CASE WHEN status NOT IN ('Dispatched', 'Delivered') THEN 1 ELSE 0 END) as pending_tickets,
        COALESCE(SUM(qty_in_pick_ticket), 0) as total_qty
      FROM pick_tickets
      ${whCondition}
      GROUP BY route
      ORDER BY total_tickets DESC
    `, whParams);

    // 3. Recent 10 Operations Trajectory Feed (Isolated by active warehouse)
    const recentActivity = await dbAsync.all(`
      SELECT 
        pt.ticket_no,
        pt.date as ticket_date,
        pt.time as ticket_time,
        pt.party_name,
        pt.party_code,
        pt.route,
        pt.qty_in_pick_ticket,
        pt.status as ticket_status,
        b.bill_no,
        b.invoice_amount,
        COALESCE(dp.status, d.status, CASE WHEN pt.status IN ('Dispatched', 'Delivered') THEN 'Dispatched' ELSE 'Pending' END) as dispatch_status
      FROM pick_tickets pt
      LEFT JOIN billings b ON pt.id = b.pick_ticket_id
      LEFT JOIN dispatch_parties dp ON b.id = dp.billing_id
      LEFT JOIN dispatches d ON dp.dispatch_id = d.id
      ${ptWhCondition}
      ORDER BY pt.id DESC
      LIMIT 10
    `, ptWhParams);

    // 4. Chart Data
    const chartData = [
      { day: 'Mon', tickets: 14, billed: 12, dispatched: 10 },
      { day: 'Tue', tickets: 18, billed: 16, dispatched: 15 },
      { day: 'Wed', tickets: 15, billed: 14, dispatched: 12 },
      { day: 'Thu', tickets: 22, billed: 20, dispatched: 19 },
      { day: 'Fri', tickets: 25, billed: 24, dispatched: 22 },
      { day: 'Sat', tickets: 19, billed: 18, dispatched: 17 },
      { day: 'Sun', tickets: 10, billed: 8, dispatched: 8 }
    ];

    return res.json({
      kpis: {
        totalPickTickets: totalPickTickets.count || 0,
        pendingPicking: pendingPicking.count || 0,
        pickedTickets: pickedTickets.count || 0,
        totalBillings: totalBillings.count || 0,
        pendingBilling: pendingBilling.count || 0,
        dispatchedOrders: dispatchedOrders.count || 0,
        totalBilledAmount: billedAmount.total || 0,
        activeDrivers: activeDrivers.count || 0,
        totalVehicles: totalVehicles.count || 0
      },
      routeBreakdown,
      recentActivity,
      chartData
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    return res.status(500).json({ message: 'Error fetching dashboard stats.' });
  }
}

module.exports = {
  getStats
};
