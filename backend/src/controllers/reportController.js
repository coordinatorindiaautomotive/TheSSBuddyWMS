const { dbAsync } = require('../config/db');

function formatDuration(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 'In Progress';
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'In Progress';

  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return '0 min';

  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  if (hours > 0) {
    return `${hours} hr${hours > 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
  }
  return `${mins} min${mins !== 1 ? 's' : ''}`;
}

async function getGranularAuditReport(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const { fromDate, toDate, route, status, search } = req.query;

    let sql = `
      SELECT 
        pt.id as ticket_id,
        pt.ticket_no,
        pt.date as ticket_date,
        pt.time as ticket_time,
        pt.customer_order_no,
        pt.party_code,
        pt.party_name,
        pt.route,
        pt.salesman,
        pt.priority,
        pt.qty_in_pick_ticket,
        COALESCE(pkh_p.name, pt.picker_id, 'Floor Picker') as picker_name,
        COALESCE(pkh_p.employee_code, 'EMP-1') as picker_code,
        pt.created_at as assigned_at,
        pt.status as ticket_status,
        pt.created_at as ticket_created_at,
        
        b.bill_no,
        b.billing_date,
        b.billing_time,
        b.start_time as checking_start_time,
        b.end_time as checking_end_time,
        b.billed_qty,
        b.invoice_amount,
        b.short_qty,
        b.excess_qty,
        b.damage_qty,
        b.billing_remarks,
        COALESCE(pkh_c.name, b.checker_id, '—') as checker_name,
        COALESCE(pkh_h.name, b.helper_id, '—') as helper_name,
        b.created_at as billing_created_at,

        d.dispatch_no,
        dp.delivered_at as dispatched_at,
        d.started_at as dispatch_started_at,
        d.completed_at as dispatch_completed_at,
        drv.name as driver_name,
        drv.phone as driver_mobile,
        v.vehicle_number,
        COALESCE(dp.status, d.status, CASE WHEN pt.status IN ('Dispatched', 'Delivered') THEN 'Dispatched' ELSE 'Pending Dispatch' END) as dispatch_status
      FROM pick_tickets pt
      LEFT JOIN billings b ON pt.id = b.pick_ticket_id
      LEFT JOIN dispatch_parties dp ON b.id = dp.billing_id
      LEFT JOIN dispatches d ON dp.dispatch_id = d.id
      LEFT JOIN picker_checker_helpers pkh_p ON pt.picker_id = pkh_p.id OR pt.picker_id = pkh_p.employee_code
      LEFT JOIN picker_checker_helpers pkh_c ON b.checker_id = pkh_c.id OR b.checker_id = pkh_c.employee_code
      LEFT JOIN picker_checker_helpers pkh_h ON b.helper_id = pkh_h.id OR b.helper_id = pkh_h.employee_code
      LEFT JOIN drivers drv ON d.driver_id = drv.id
      LEFT JOIN vehicles v ON d.vehicle_id = v.id
      WHERE pt.warehouse_id = ?
    `;

    const params = [whId];

    if (fromDate) {
      sql += ` AND pt.date >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      sql += ` AND pt.date <= ?`;
      params.push(toDate);
    }
    if (route) {
      sql += ` AND LOWER(pt.route) = LOWER(?)`;
      params.push(route);
    }
    if (status) {
      if (status === 'Dispatched') {
        sql += ` AND (pt.status IN ('Dispatched', 'Delivered') OR dp.status = 'Dispatched' OR d.status = 'Completed')`;
      } else if (status === 'Pending') {
        sql += ` AND pt.status NOT IN ('Dispatched', 'Delivered')`;
      }
    }
    if (search) {
      sql += ` AND (pt.ticket_no LIKE ? OR pt.party_name LIKE ? OR pt.party_code LIKE ? OR b.bill_no LIKE ? OR drv.name LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    sql += ` ORDER BY pt.id DESC`;

    const rows = await dbAsync.all(sql, params);

    const formattedReport = rows.map(r => {
      const entryTime = r.ticket_date && r.ticket_time ? `${r.ticket_date} ${r.ticket_time}` : r.ticket_created_at;
      const billingTime = r.billing_date && r.billing_time ? `${r.billing_date} ${r.billing_time}` : r.billing_created_at;
      const dispatchTime = r.dispatched_at || r.dispatch_completed_at || (r.dispatch_status === 'Dispatched' ? r.billing_created_at : null);

      const checkingDuration = formatDuration(r.checking_start_time, r.checking_end_time);
      const totalSLA = dispatchTime ? formatDuration(entryTime, dispatchTime) : 'Pending Dispatch (In Progress)';

      return {
        ticket_no: r.ticket_no,
        ticket_entry_time: entryTime || '—',
        order_no: r.customer_order_no || '—',
        party_code: r.party_code || '—',
        party_name: r.party_name || '—',
        route: r.route || '—',
        salesman: r.salesman || '—',
        pick_qty: r.qty_in_pick_ticket || 0,
        priority: r.priority || 'Normal',
        picker_name: r.picker_name,
        picker_code: r.picker_code,
        picker_assigned_at: r.assigned_at || r.ticket_created_at || '—',
        picking_status: r.ticket_status,

        bill_no: r.bill_no || 'Pending Billing',
        billing_time: billingTime || '—',
        billed_qty: r.billed_qty || 0,
        invoice_amount: r.invoice_amount ? `₹${r.invoice_amount.toLocaleString()}` : '₹0',
        checking_start_time: r.checking_start_time || '—',
        checking_end_time: r.checking_end_time || '—',
        checking_duration: checkingDuration,
        short_qty: r.short_qty || 0,
        excess_qty: r.excess_qty || 0,
        damage_qty: r.damage_qty || 0,
        checker_name: r.checker_name,
        helper_name: r.helper_name,
        billing_remarks: r.billing_remarks || '—',

        dispatch_no: r.dispatch_no || 'Pending Dispatch',
        dispatch_time: dispatchTime || 'Pending Dispatch',
        driver_name: r.driver_name || '—',
        driver_mobile: r.driver_mobile || '—',
        vehicle_number: r.vehicle_number || '—',
        dispatch_status: r.dispatch_status,

        total_turnaround_sla: totalSLA
      };
    });

    return res.json(formattedReport);
  } catch (err) {
    console.error('Error generating granular audit report:', err);
    return res.status(500).json({ message: 'Error generating granular audit report.' });
  }
}

async function getEndToEndLifecycleReport(req, res) {
  return getGranularAuditReport(req, res);
}

async function getDispatchReport(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const { fromDate, toDate, search } = req.query;

    let sql = `
      SELECT d.dispatch_no, d.status, d.total_cartons, d.scanned_cartons, d.total_amount, d.started_at, d.completed_at,
             drv.name as driver_name, v.vehicle_number
      FROM dispatches d
      LEFT JOIN drivers drv ON d.driver_id = drv.id
      LEFT JOIN vehicles v ON d.vehicle_id = v.id
      WHERE d.warehouse_id = ?
    `;
    const params = [whId];

    if (fromDate) {
      sql += ` AND d.started_at >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      sql += ` AND d.started_at <= ?`;
      params.push(toDate + ' 23:59:59');
    }
    if (search) {
      sql += ` AND (d.dispatch_no LIKE ? OR drv.name LIKE ? OR v.vehicle_number LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ` ORDER BY d.created_at DESC`;

    const report = await dbAsync.all(sql, params);
    return res.json(report);
  } catch (err) {
    return res.status(500).json({ message: 'Error generating dispatch report.' });
  }
}

async function getBillingReport(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const { fromDate, toDate, search } = req.query;

    let sql = `
      SELECT b.bill_no, b.invoice_amount, b.created_at, pt.ticket_no, p.party_name, c.name as checker_name
      FROM billings b
      JOIN pick_tickets pt ON b.pick_ticket_id = pt.id
      JOIN parties p ON pt.party_code = p.party_code
      LEFT JOIN picker_checker_helpers c ON b.checker_id = c.id
      WHERE b.warehouse_id = ?
    `;
    const params = [whId];

    if (fromDate) {
      sql += ` AND b.billing_date >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      sql += ` AND b.billing_date <= ?`;
      params.push(toDate);
    }
    if (search) {
      sql += ` AND (b.bill_no LIKE ? OR pt.ticket_no LIKE ? OR p.party_name LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ` ORDER BY b.created_at DESC`;

    const report = await dbAsync.all(sql, params);
    return res.json(report);
  } catch (err) {
    return res.status(500).json({ message: 'Error generating billing report.' });
  }
}

module.exports = {
  getGranularAuditReport,
  getEndToEndLifecycleReport,
  getDispatchReport,
  getBillingReport
};
