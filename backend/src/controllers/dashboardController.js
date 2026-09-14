const { dbAsync } = require('../config/db');

async function getStats(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;

    const whCondition = 'WHERE warehouse_id = ?';
    const whParams = [whId];

    const ptWhCondition = 'WHERE pt.warehouse_id = ?';
    const ptWhParams = [whId];

    // Today's Date Strings for flexible matching (ISO, Local, Date prefixes)
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const todayDMY = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const todayFormatted = now.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

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

    // Return & Arrange Operations KPIs (All-time & Today)
    let returnsToday = { count: 0, qty: 0, val: 0, dms_done: 0, dms_pending: 0 };
    let pendingDmsReturns = { count: 0 };
    let totalReturns = { count: 0 };
    try {
      returnsToday = await dbAsync.get(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(total_qty), 0) as qty,
          COALESCE(SUM(total_value), 0) as val,
          SUM(CASE WHEN is_dms_received = 1 THEN 1 ELSE 0 END) as dms_done,
          SUM(CASE WHEN is_dms_received = 0 OR is_dms_received IS NULL THEN 1 ELSE 0 END) as dms_pending
        FROM returns 
        ${whCondition} AND (return_date = ? OR return_date LIKE ? OR created_at LIKE ?)
      `, [...whParams, todayISO, `${todayISO}%`, `${todayISO}%`]);
      pendingDmsReturns = await dbAsync.get(`SELECT COUNT(*) as count FROM returns ${whCondition} AND (is_dms_received = 0 OR is_dms_received IS NULL)`, whParams);
      totalReturns = await dbAsync.get(`SELECT COUNT(*) as count FROM returns ${whCondition}`, whParams);
    } catch (e) {}

    let arrangesToday = { count: 0, qty: 0, converted: 0, pending: 0 };
    let pendingPickTicketArranges = { count: 0 };
    let arrangeBillingConverted = { count: 0 };
    let totalArranges = { count: 0 };
    try {
      arrangesToday = await dbAsync.get(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(total_qty), 0) as qty,
          SUM(CASE WHEN pick_ticket_id IS NOT NULL OR billing_id IS NOT NULL THEN 1 ELSE 0 END) as converted,
          SUM(CASE WHEN pick_ticket_id IS NULL AND billing_id IS NULL THEN 1 ELSE 0 END) as pending
        FROM arranges 
        ${whCondition} AND (arrange_date = ? OR arrange_date LIKE ? OR created_at LIKE ?)
      `, [...whParams, todayISO, `${todayISO}%`, `${todayISO}%`]);
      pendingPickTicketArranges = await dbAsync.get(`SELECT COUNT(*) as count FROM arranges ${whCondition} AND pick_ticket_id IS NULL`, whParams);
      arrangeBillingConverted = await dbAsync.get(`SELECT COUNT(*) as count FROM arranges ${whCondition} AND (pick_ticket_id IS NOT NULL OR billing_id IS NOT NULL)`, whParams);
      totalArranges = await dbAsync.get(`SELECT COUNT(*) as count FROM arranges ${whCondition}`, whParams);
    } catch (e) {}

    // 2. Today's Specific Snapshot Metrics
    const todayPT = await dbAsync.get(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(qty_in_pick_ticket), 0) as qty,
        SUM(CASE WHEN status = 'Picked' THEN 1 ELSE 0 END) as picked,
        SUM(CASE WHEN status IN ('Created', 'Assigned', 'Pending') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status IN ('Dispatched', 'Delivered') THEN 1 ELSE 0 END) as dispatched
      FROM pick_tickets 
      ${whCondition} AND (date = ? OR date LIKE ? OR created_at LIKE ?)
    `, [...whParams, todayISO, `${todayISO}%`, `${todayISO}%`]);

    const todayBill = await dbAsync.get(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(invoice_amount), 0) as amount,
        COALESCE(SUM(billed_qty), 0) as qty
      FROM billings 
      ${whCondition} AND (billing_date = ? OR billing_date LIKE ? OR created_at LIKE ?)
    `, [...whParams, todayISO, `${todayISO}%`, `${todayISO}%`]);

    let todayDisp = { count: 0, cartons: 0, total_amount: 0, in_transit: 0, delivered: 0 };
    try {
      todayDisp = await dbAsync.get(`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(total_cartons), 0) as cartons,
          COALESCE(SUM(total_amount), 0) as total_amount,
          SUM(CASE WHEN status = 'In Transit' THEN 1 ELSE 0 END) as in_transit,
          SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as delivered
        FROM dispatches 
        ${whCondition} AND (dispatch_date = ? OR dispatch_date LIKE ? OR created_at LIKE ?)
      `, [...whParams, todayISO, `${todayISO}%`, `${todayISO}%`]);
    } catch (e) {}

    // Today's Route Breakdown
    const todayRouteBreakdown = await dbAsync.all(`
      SELECT 
        route, 
        COUNT(*) as total_tickets,
        SUM(CASE WHEN status IN ('Dispatched', 'Delivered') THEN 1 ELSE 0 END) as dispatched_tickets,
        SUM(CASE WHEN status NOT IN ('Dispatched', 'Delivered') THEN 1 ELSE 0 END) as pending_tickets,
        COALESCE(SUM(qty_in_pick_ticket), 0) as total_qty
      FROM pick_tickets
      ${whCondition} AND (date = ? OR date LIKE ? OR created_at LIKE ?)
      GROUP BY route
      ORDER BY total_tickets DESC
    `, [...whParams, todayISO, `${todayISO}%`, `${todayISO}%`]);

    // 3. General Route Breakdown (Isolated by active warehouse)
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

    // 4. Recent 10 Operations Trajectory Feed (Isolated by active warehouse)
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

    // 5. Chart Data
    const chartData = [
      { day: 'Mon', tickets: 14, billed: 12, dispatched: 10 },
      { day: 'Tue', tickets: 18, billed: 16, dispatched: 15 },
      { day: 'Wed', tickets: 15, billed: 14, dispatched: 12 },
      { day: 'Thu', tickets: 22, billed: 20, dispatched: 19 },
      { day: 'Fri', tickets: 25, billed: 24, dispatched: 22 },
      { day: 'Sat', tickets: 19, billed: 18, dispatched: 17 },
      { day: 'Sun', tickets: 10, billed: 8, dispatched: 8 }
    ];

    const todaySnapshot = {
      dateFormatted: todayFormatted,
      dateISO: todayISO,
      pickTickets: {
        count: todayPT?.count || 0,
        qty: todayPT?.qty || 0,
        picked: todayPT?.picked || 0,
        pending: todayPT?.pending || 0,
        dispatched: todayPT?.dispatched || 0
      },
      billings: {
        count: todayBill?.count || 0,
        amount: todayBill?.amount || 0,
        qty: todayBill?.qty || 0
      },
      dispatches: {
        count: todayDisp?.count || 0,
        cartons: todayDisp?.cartons || 0,
        amount: todayDisp?.total_amount || 0,
        inTransit: todayDisp?.in_transit || 0,
        delivered: todayDisp?.delivered || 0
      },
      returns: {
        count: returnsToday?.count || 0,
        qty: returnsToday?.qty || 0,
        val: returnsToday?.val || 0,
        dmsDone: returnsToday?.dms_done || 0,
        dmsPending: returnsToday?.dms_pending || 0
      },
      arranges: {
        count: arrangesToday?.count || 0,
        qty: arrangesToday?.qty || 0,
        converted: arrangesToday?.converted || 0,
        pending: arrangesToday?.pending || 0
      },
      routes: todayRouteBreakdown || []
    };

    return res.json({
      todaySnapshot,
      kpis: {
        totalPickTickets: totalPickTickets.count || 0,
        pendingPicking: pendingPicking.count || 0,
        pickedTickets: pickedTickets.count || 0,
        totalBillings: totalBillings.count || 0,
        pendingBilling: pendingBilling.count || 0,
        dispatchedOrders: dispatchedOrders.count || 0,
        totalBilledAmount: billedAmount.total || 0,
        activeDrivers: activeDrivers.count || 0,
        totalVehicles: totalVehicles.count || 0,
        returnsToday: returnsToday?.count || 0,
        pendingDmsReturns: pendingDmsReturns?.count || 0,
        totalReturns: totalReturns?.count || 0,
        arrangesToday: arrangesToday?.count || 0,
        pendingPickTicketArranges: pendingPickTicketArranges?.count || 0,
        arrangeBillingConverted: arrangeBillingConverted?.count || 0,
        totalArranges: totalArranges?.count || 0
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
