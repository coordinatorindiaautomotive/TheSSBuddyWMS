const { dbAsync } = require('../config/db');

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

// Route Bill Status Tracker Controller APIs
async function getPartyBillStatus(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const { routeId, fromDate, toDate, statusFilter, search } = req.query;

    let partySql = `
      SELECT p.*, rm.route_name as master_route_name
      FROM parties p
      LEFT JOIN route_masters rm ON p.route_id = rm.id
      WHERE p.warehouse_id = ?
    `;
    let partyParams = [whId];
    if (routeId) {
      const targetRoute = await dbAsync.get('SELECT * FROM route_masters WHERE id = ? OR route_name = ?', [routeId, routeId]);
      if (targetRoute) {
        partySql += ' AND (p.route_id = ? OR rm.id = ? OR p.route_name = ?)';
        partyParams.push(targetRoute.id, targetRoute.id, targetRoute.route_name);
      } else {
        partySql += ' AND (p.route_id = ? OR rm.id = ? OR p.route_name = ?)';
        partyParams.push(routeId, routeId, routeId);
      }
    }
    const parties = await dbAsync.all(partySql, partyParams);

    let ptSql = `
      SELECT pt.*, b.id as billing_id, b.bill_no, b.billed_qty, b.created_at as billing_date
      FROM pick_tickets pt
      LEFT JOIN billings b ON pt.id = b.pick_ticket_id
      WHERE pt.warehouse_id = ?
    `;
    let ptParams = [whId];
    if (fromDate) {
      ptSql += ' AND pt.date >= ?';
      ptParams.push(fromDate);
    }
    if (toDate) {
      ptSql += ' AND pt.date <= ?';
      ptParams.push(toDate);
    }
    const allTickets = await dbAsync.all(ptSql, ptParams);

    const partyDataMap = {};
    for (const party of parties) {
      partyDataMap[party.party_code] = {
        partyCode: party.party_code,
        partyName: party.party_name,
        route: party.master_route_name || party.route_name || 'Direct Route',
        salesman: party.salesman || 'General Sales',
        totalPickTickets: 0,
        pendingCount: 0,
        billedCount: 0,
        dispatchedCount: 0,
        pendingTickets: [],
        billedTickets: []
      };
    }

    for (const t of allTickets) {
      let pCode = t.party_code;
      if (!partyDataMap[pCode]) {
        partyDataMap[pCode] = {
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

      const pEntry = partyDataMap[pCode];
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
      const q = search.toLowerCase();
      resultList = resultList.filter(p =>
        p.partyCode.toLowerCase().includes(q) ||
        p.partyName.toLowerCase().includes(q) ||
        p.pendingTickets.some(t => t.pickTicketNo.toLowerCase().includes(q)) ||
        p.billedTickets.some(t => t.pickTicketNo.toLowerCase().includes(q) || (t.billNo && t.billNo.toLowerCase().includes(q)))
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
      await dbAsync.run("UPDATE pick_tickets SET status = 'Dispatched', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    }

    return res.json({ success: true, message: `Successfully marked ${selectedIds.length} ticket(s) as Dispatched!` });
  } catch (err) {
    console.error('Error marking tickets dispatched:', err);
    return res.status(500).json({ message: 'Error updating ticket status.' });
  }
}

module.exports = {
  getPlanningData,
  createTrip,
  getPartyBillStatus,
  markTicketsDispatched
};
