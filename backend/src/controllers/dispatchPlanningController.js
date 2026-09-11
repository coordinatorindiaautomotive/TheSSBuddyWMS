const { dbAsync } = require('../config/db');
const { getOperationsConsoleData } = require('../services/routeSchedulingEngine');

async function getOperationsConsole(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const consoleData = await getOperationsConsoleData(whId);
    return res.json(consoleData);
  } catch (err) {
    console.error('Error calculating Operations Console data:', err);
    return res.status(500).json({ message: 'Error calculating Operations Console data.' });
  }
}

async function createOnDemandDispatch(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const { route_id, route_name } = req.body;

    const rName = route_name || (await dbAsync.get('SELECT route_name FROM route_masters WHERE id = ?', [route_id]))?.route_name;
    if (!rName) {
      return res.status(400).json({ message: 'Route identification is required.' });
    }

    // Find pending billings for this route
    const pendingBills = await dbAsync.all(`
      SELECT b.id, b.bill_no, b.invoice_amount, pt.qty_in_pick_ticket as total_cartons, pt.party_code
      FROM billings b
      JOIN pick_tickets pt ON b.pick_ticket_id = pt.id
      WHERE b.warehouse_id = ? 
        AND LOWER(pt.route) = LOWER(?)
        AND b.id NOT IN (SELECT billing_id FROM dispatch_parties WHERE status != 'Failed')
    `, [whId, rName]);

    return res.json({
      message: 'On-Demand dispatch review generated.',
      route_name: rName,
      eligibleBills: pendingBills,
      totalBills: pendingBills.length,
      totalCartons: pendingBills.reduce((acc, b) => acc + (b.total_cartons || 1), 0),
      totalAmount: pendingBills.reduce((acc, b) => acc + (b.invoice_amount || 0), 0)
    });
  } catch (err) {
    console.error('Error creating on-demand dispatch:', err);
    return res.status(500).json({ message: 'Error initiating on-demand dispatch.' });
  }
}

async function getPlanningData(req, res) {
  try {
    const whId = req.activeWarehouseId;

    const routes = await dbAsync.all('SELECT * FROM route_masters WHERE warehouse_id = ?', [whId]);
    const drivers = await dbAsync.all("SELECT * FROM drivers WHERE warehouse_id = ? AND status = 'Available'", [whId]);
    const vehicles = await dbAsync.all("SELECT * FROM vehicles WHERE warehouse_id = ? AND status = 'Available'", [whId]);

    const pendingBillings = await dbAsync.all(`
      SELECT b.*, p.party_name, p.party_code, p.address, p.city, p.route_id, rm.route_name, pt.qty_in_pick_ticket as total_cartons
      FROM billings b
      JOIN pick_tickets pt ON b.pick_ticket_id = pt.id
      JOIN parties p ON pt.party_code = p.party_code AND p.warehouse_id = b.warehouse_id
      LEFT JOIN route_masters rm ON p.route_id = rm.id
      WHERE b.warehouse_id = ?
        AND b.id NOT IN (SELECT billing_id FROM dispatch_parties WHERE status != 'Failed')
      ORDER BY b.created_at DESC
    `, [whId]);

    return res.json({
      routes,
      drivers,
      vehicles,
      pendingBillings
    });
  } catch (err) {
    console.error('Dispatch planning data error:', err);
    return res.status(500).json({ message: 'Error fetching dispatch planning data.' });
  }
}

async function createTrip(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const { driver_id, vehicle_id, billing_ids, notes } = req.body;

    if (!driver_id || !vehicle_id || !billing_ids || !billing_ids.length) {
      return res.status(400).json({ message: 'Driver, vehicle, and at least one bill are required.' });
    }

    const dispatchNo = `DSP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const placeholders = billing_ids.map(() => '?').join(',');
    const selectedBillings = await dbAsync.all(`
      SELECT b.*, pt.party_code, pt.qty_in_pick_ticket as total_cartons
      FROM billings b
      JOIN pick_tickets pt ON b.pick_ticket_id = pt.id
      WHERE b.id IN (${placeholders})
    `, billing_ids);

    let totalCartons = 0;
    let totalAmount = 0;
    selectedBillings.forEach(b => {
      totalCartons += b.total_cartons || 1;
      totalAmount += b.invoice_amount || 0;
    });

    const dispatchRes = await dbAsync.run(`
      INSERT INTO dispatches (dispatch_no, driver_id, vehicle_id, warehouse_id, status, total_cartons, scanned_cartons, total_amount, notes, started_at)
      VALUES (?, ?, ?, ?, 'Loading', ?, 0, ?, ?, CURRENT_TIMESTAMP)
    `, [dispatchNo, driver_id, vehicle_id, whId, totalCartons, totalAmount, notes || '']);

    const dispatchId = dispatchRes.id;

    for (const bill of selectedBillings) {
      const dpRes = await dbAsync.run(`
        INSERT INTO dispatch_parties (dispatch_id, party_code, billing_id, warehouse_id, status, total_cartons, scanned_cartons)
        VALUES (?, ?, ?, ?, 'Pending', ?, 0)
      `, [dispatchId, bill.party_code, bill.id, whId, bill.total_cartons || 1]);

      const dpId = dpRes.id;

      for (let i = 1; i <= (bill.total_cartons || 1); i++) {
        const barcode = `CTN-${bill.party_code}-${bill.id}-${i}`;
        await dbAsync.run(`
          INSERT INTO cartons (barcode_no, dispatch_party_id, dispatch_id, warehouse_id, is_scanned)
          VALUES (?, ?, ?, ?, 0)
        `, [barcode, dpId, dispatchId, whId]);
      }

      await dbAsync.run("UPDATE pick_tickets SET status = 'Dispatched' WHERE id = ?", [bill.pick_ticket_id]);
    }

    await dbAsync.run("UPDATE drivers SET status = 'In Transit' WHERE id = ?", [driver_id]);
    await dbAsync.run("UPDATE vehicles SET status = 'In Transit' WHERE id = ?", [vehicle_id]);

    await dbAsync.run(`
      INSERT INTO notifications (message, type, warehouse_id)
      VALUES (?, 'Info', ?)
    `, [`New Dispatch ${dispatchNo} created and assigned to driver.`, whId]);

    return res.json({ message: 'Dispatch trip created successfully!', dispatch_no: dispatchNo, id: dispatchId });
  } catch (err) {
    console.error('Error creating trip:', err);
    return res.status(500).json({ message: 'Error creating dispatch trip.' });
  }
}

function normalizeRouteKey(r) {
  if (!r) return '';
  return String(r).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function routesMatch(rName1, rName2, rCode1, rCode2) {
  const keys1 = [normalizeRouteKey(rName1), normalizeRouteKey(rCode1)].filter(k => k && k !== 'unassigned');
  const keys2 = [normalizeRouteKey(rName2), normalizeRouteKey(rCode2)].filter(k => k && k !== 'unassigned');
  if (keys1.length === 0 || keys2.length === 0) return false;
  return keys1.some(k1 => keys2.some(k2 => k1 === k2 || k1.includes(k2) || k2.includes(k1)));
}

function normalizeDateStr(d) {
  if (!d) return '';
  const clean = String(d).trim().split('T')[0].split(' ')[0];
  if (/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/.test(clean)) {
    const match = clean.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    const day = String(match[1]).padStart(2, '0');
    const month = String(match[2]).padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  if (/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/.test(clean)) {
    const match = clean.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    const year = match[1];
    const month = String(match[2]).padStart(2, '0');
    const day = String(match[3]).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return clean;
}

// Route Bill Status Tracker Controller APIs
async function getPartyBillStatus(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const { routeId, fromDate, toDate, statusFilter, search } = req.query;

    let targetRoute = null;
    if (routeId && routeId !== 'ALL') {
      targetRoute = await dbAsync.get(`
        SELECT * FROM route_masters 
        WHERE (id = ? OR route_name = ? OR route_code = ?) 
          AND (warehouse_id = ? OR warehouse_id IS NULL OR ? = 1)
      `, [routeId, routeId, routeId, whId, whId]);
    }

    let partySql = `
      SELECT p.*, rm.route_name as master_route_name, rm.route_code as master_route_code
      FROM parties p
      LEFT JOIN route_masters rm ON p.route_id = rm.id
      WHERE (p.warehouse_id = ? OR p.warehouse_id IS NULL OR ? = 1)
    `;
    let partyParams = [whId, whId];

    if (targetRoute) {
      partySql += ` AND (
        p.route_id = ? 
        OR rm.id = ? 
        OR LOWER(TRIM(p.route_name)) = LOWER(TRIM(?))
        OR (rm.route_name IS NOT NULL AND LOWER(TRIM(rm.route_name)) = LOWER(TRIM(?)))
      )`;
      partyParams.push(targetRoute.id, targetRoute.id, targetRoute.route_name, targetRoute.route_name);
    } else if (routeId && routeId !== 'ALL') {
      partySql += ` AND LOWER(TRIM(p.route_name)) = LOWER(TRIM(?))`;
      partyParams.push(String(routeId).trim());
    }

    const parties = await dbAsync.all(partySql, partyParams);

    let ptSql = `
      SELECT pt.*, b.id as billing_id, b.bill_no, b.billed_qty, b.created_at as billing_date
      FROM pick_tickets pt
      LEFT JOIN billings b ON pt.id = b.pick_ticket_id
      WHERE (pt.warehouse_id = ? OR pt.warehouse_id IS NULL OR ? = 1)
        AND (pt.status IS NULL OR LOWER(pt.status) NOT IN ('cancelled', 'canceled'))
    `;
    let ptParams = [whId, whId];
    const allTicketsRaw = await dbAsync.all(ptSql, ptParams);

    const normFrom = fromDate ? normalizeDateStr(fromDate) : null;
    const normTo = toDate ? normalizeDateStr(toDate) : null;

    const allTickets = (allTicketsRaw || []).filter(t => {
      // Pending tickets are always included in status view unless outside explicit date range
      if (!normFrom && !normTo) return true;
      const tNorm = normalizeDateStr(t.date) || (t.created_at ? normalizeDateStr(t.created_at) : '');
      if (!tNorm) return true;
      if (normFrom && tNorm < normFrom) return false;
      if (normTo && tNorm > normTo) return false;
      return true;
    });

    const partyDataMap = {};
    const validPartyCodes = new Set();

    for (const party of (parties || [])) {
      const code = String(party.party_code).trim();
      const codeUpper = code.toUpperCase();
      validPartyCodes.add(codeUpper);

      partyDataMap[codeUpper] = {
        partyCode: party.party_code,
        partyName: party.party_name,
        route: party.master_route_name || party.route_name || targetRoute?.route_name || 'Direct Route',
        salesman: party.salesman || 'General Sales',
        totalPickTickets: 0,
        pendingCount: 0,
        billedCount: 0,
        dispatchedCount: 0,
        pendingTickets: [],
        billedTickets: []
      };
    }

    for (const t of (allTickets || [])) {
      const pCode = String(t.party_code || '').trim();
      const pCodeUpper = pCode.toUpperCase();

      // If a route filter is active, check party match or ticket route match
      if (targetRoute || (routeId && routeId !== 'ALL')) {
        const targetRouteName = targetRoute ? targetRoute.route_name : routeId;
        const targetRouteCode = targetRoute ? targetRoute.route_code : routeId;
        const isPartyMatch = validPartyCodes.has(pCodeUpper);
        const isTicketRouteMatch = routesMatch(t.route, targetRouteName, t.route, targetRouteCode);

        if (!isPartyMatch && !isTicketRouteMatch) {
          continue;
        }

        if (!partyDataMap[pCodeUpper]) {
          partyDataMap[pCodeUpper] = {
            partyCode: pCode,
            partyName: t.party_name || pCode,
            route: t.route || targetRoute?.route_name || 'Direct Route',
            salesman: t.salesman || 'General Sales',
            totalPickTickets: 0,
            pendingCount: 0,
            billedCount: 0,
            dispatchedCount: 0,
            pendingTickets: [],
            billedTickets: []
          };
        }
      } else {
        if (!partyDataMap[pCodeUpper]) {
          partyDataMap[pCodeUpper] = {
            partyCode: pCode,
            partyName: t.party_name || pCode,
            route: t.route || 'Direct Route',
            salesman: t.salesman || 'General Sales',
            totalPickTickets: 0,
            pendingCount: 0,
            billedCount: 0,
            dispatchedCount: 0,
            pendingTickets: [],
            billedTickets: []
          };
        }
      }

      const pEntry = partyDataMap[pCodeUpper];
      if (!pEntry) continue;

      pEntry.totalPickTickets += 1;

      if (t.status === 'Dispatched' || t.status === 'Delivered') {
        pEntry.dispatchedCount += 1;
        pEntry.billedTickets.push({
          pickTicketId: t.id,
          pickTicketNo: t.ticket_no,
          billNo: t.bill_no || 'BILLED',
          qty: t.qty_in_pick_ticket,
          isDispatched: true,
          dispatchedAt: t.updated_at ? new Date(t.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Today'
        });
      } else if (t.status === 'Billed' || t.billing_id) {
        pEntry.billedCount += 1;
        pEntry.billedTickets.push({
          pickTicketId: t.id,
          pickTicketNo: t.ticket_no,
          billNo: t.bill_no || 'BILLED',
          qty: t.qty_in_pick_ticket,
          isDispatched: false
        });
      } else {
        pEntry.pendingCount += 1;
        pEntry.pendingTickets.push({
          pickTicketId: t.id,
          pickTicketNo: t.ticket_no,
          qty: t.qty_in_pick_ticket,
          date: t.date
        });
      }
    }

    let resultList = Object.values(partyDataMap);

    if (search) {
      const q = String(search).toLowerCase().trim();
      resultList = resultList.filter(p =>
        (p.partyCode && String(p.partyCode).toLowerCase().includes(q)) ||
        (p.partyName && String(p.partyName).toLowerCase().includes(q)) ||
        (Array.isArray(p.pendingTickets) && p.pendingTickets.some(t => t.pickTicketNo && String(t.pickTicketNo).toLowerCase().includes(q))) ||
        (Array.isArray(p.billedTickets) && p.billedTickets.some(t => (t.pickTicketNo && String(t.pickTicketNo).toLowerCase().includes(q)) || (t.billNo && String(t.billNo).toLowerCase().includes(q))))
      );
    }

    if (statusFilter === 'pending') {
      resultList = resultList.filter(p => p.pendingCount > 0 || (p.billedCount > 0 && p.pendingCount > 0));
    } else if (statusFilter === 'billed') {
      resultList = resultList.filter(p => p.billedCount > 0 || p.dispatchedCount > 0);
    } else if (statusFilter === 'dispatched') {
      resultList = resultList.filter(p => p.dispatchedCount > 0);
    }

    return res.json(resultList);
  } catch (err) {
    console.error('Error fetching party bill status:', err);
    return res.status(500).json({ message: 'Error fetching route bill status.' });
  }
}

async function markTicketsDispatched(req, res) {
  try {
    const selectedIds = req.body;
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
      return res.status(400).json({ message: 'No tickets selected.' });
    }

    for (const id of selectedIds) {
      await dbAsync.run("UPDATE pick_tickets SET status = 'Dispatched' WHERE id = ?", [id]);
    }

    return res.json({ success: true, message: `Successfully marked ${selectedIds.length} ticket(s) as Dispatched!` });
  } catch (err) {
    console.error('Error marking tickets dispatched:', err);
    return res.status(500).json({ message: 'Error updating ticket status.' });
  }
}

module.exports = {
  getOperationsConsole,
  createOnDemandDispatch,
  getPlanningData,
  createTrip,
  getPartyBillStatus,
  markTicketsDispatched
};
