const xlsx = require('xlsx');
const { dbAsync } = require('../config/db');

async function importExcel(req, res) {
  try {
    const { entity_type } = req.body; // 'PickTickets', 'Parties', 'Vehicles', 'Drivers'
    if (!req.file) {
      return res.status(400).json({ message: 'Excel file is required.' });
    }

    const whId = req.activeWarehouseId;
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let imported = 0;

    if (entity_type === 'FullReport' || entity_type === 'PickTickets') {
      // Check if file is PickToDelivery Full Report
      const isFullReport = rows.length > 0 && ('Pick Ticket No' in rows[0] || 'Pick Ticket' in rows[0]);

      if (isFullReport) {
        let whRecord = await dbAsync.get('SELECT id FROM warehouses WHERE id = ?', [whId]);
        if (!whRecord) {
          whRecord = await dbAsync.get('SELECT id FROM warehouses LIMIT 1');
        }
        const activeWhId = whRecord ? whRecord.id : 1;

        // 1. Collect & Insert Routes
        const routeSet = new Set();
        const salesmanSet = new Set();
        const workerSet = new Set();
        const partyMap = new Map();

        rows.forEach(r => {
          const route = r['Route'] && r['Route'] !== '-' ? String(r['Route']).trim() : 'Direct Route';
          const salesman = r['Salesman'] && r['Salesman'] !== '-' ? String(r['Salesman']).trim() : 'General Sales';
          const picker = r['Picker'] && r['Picker'] !== '-' ? String(r['Picker']).trim() : null;
          const checker = r['Checker'] && r['Checker'] !== '-' ? String(r['Checker']).trim() : null;
          const helper = r['Helper'] && r['Helper'] !== '-' ? String(r['Helper']).trim() : null;

          if (route) routeSet.add(route);
          if (salesman) salesmanSet.add(salesman);
          if (picker) workerSet.add({ name: picker, role: 'Picker' });
          if (checker) workerSet.add({ name: checker, role: 'Checker' });
          if (helper) workerSet.add({ name: helper, role: 'Helper' });

          const pCode = r['Party Code'] && r['Party Code'] !== '-' ? String(r['Party Code']).trim().toUpperCase() : '';
          const pName = r['Party Name'] && r['Party Name'] !== '-' ? String(r['Party Name']).trim() : '';
          if (pCode && pName) {
            partyMap.set(pCode, { code: pCode, name: pName, route, salesman });
          }
        });

        // Insert Routes
        for (const rName of routeSet) {
          const ex = await dbAsync.get('SELECT id FROM route_masters WHERE LOWER(route_name) = LOWER(?) AND warehouse_id = ?', [rName, activeWhId]);
          if (!ex) {
            const rCode = 'RT-' + rName.replace(/[^A-Za-z0-9]/g, '').substring(0, 8).toUpperCase();
            await dbAsync.run('INSERT INTO route_masters (route_code, route_name, warehouse_id) VALUES (?, ?, ?)', [rCode, rName, activeWhId]);
          }
        }

        // Insert Salesmen
        for (const sName of salesmanSet) {
          const ex = await dbAsync.get('SELECT id FROM salesman_masters WHERE LOWER(salesman_name) = LOWER(?) AND warehouse_id = ?', [sName, activeWhId]);
          if (!ex) {
            const sCode = 'SM-' + sName.replace(/[^A-Za-z0-9]/g, '').substring(0, 8).toUpperCase();
            await dbAsync.run('INSERT INTO salesman_masters (salesman_code, salesman_name, warehouse_id) VALUES (?, ?, ?)', [sCode, sName, activeWhId]);
          }
        }

        // Insert Floor Workers (Pickers, Checkers, Helpers)
        for (const w of workerSet) {
          if (!w.name || w.name === '-') continue;
          const ex = await dbAsync.get('SELECT id FROM picker_checker_helpers WHERE LOWER(name) = LOWER(?) AND warehouse_id = ?', [w.name, activeWhId]);
          if (!ex) {
            const empCode = 'EMP-' + w.name.replace(/[^A-Za-z0-9]/g, '').substring(0, 8).toUpperCase();
            await dbAsync.run(
              'INSERT INTO picker_checker_helpers (employee_code, name, role, role_type, warehouse_id, is_active) VALUES (?, ?, ?, ?, ?, 1)',
              [empCode, w.name, w.role, w.role, activeWhId]
            );
          }
        }

        // Insert Parties (Upper Case party_code)
        for (const [pCode, pData] of partyMap.entries()) {
          const upperCode = pCode.toUpperCase();
          const ex = await dbAsync.get('SELECT id FROM parties WHERE UPPER(party_code) = ? AND warehouse_id = ?', [upperCode, activeWhId]);
          if (!ex) {
            await dbAsync.run(
              'INSERT INTO parties (party_code, party_name, route_name, salesman, warehouse_id) VALUES (?, ?, ?, ?, ?)',
              [upperCode, pData.name, pData.route, pData.salesman, activeWhId]
            );
          }
        }

        // Insert Pick Tickets and linked Billings
        for (const r of rows) {
          const ticketNo = r['Pick Ticket No'] && r['Pick Ticket No'] !== '-' ? String(r['Pick Ticket No']).trim().toUpperCase() : `PKT-${Math.floor(1000 + Math.random() * 9000)}`;
          const pCode = r['Party Code'] && r['Party Code'] !== '-' ? String(r['Party Code']).trim().toUpperCase() : 'PTY-1001';
          const pName = r['Party Name'] && r['Party Name'] !== '-' ? String(r['Party Name']).trim() : 'Party';
          const route = r['Route'] && r['Route'] !== '-' ? String(r['Route']).trim() : 'Direct Route';
          const salesman = r['Salesman'] && r['Salesman'] !== '-' ? String(r['Salesman']).trim() : 'General Sales';
          const pickQty = parseInt(r['Pick Qty'], 10) || 1;
          const pickDate = r['Pick Date'] ? String(r['Pick Date']).trim() : '2026-08-31';
          const pickTime = r['Pick Created Timestamp'] ? String(r['Pick Created Timestamp']).split(' ')[1] || '12:00:00' : '12:00:00';
          const status = r['Current Overall Status'] || 'Billed';

          let existingTicket = await dbAsync.get('SELECT id FROM pick_tickets WHERE ticket_no = ? AND warehouse_id = ?', [ticketNo, activeWhId]);
          let ticketId = existingTicket ? existingTicket.id : null;

          if (!ticketId) {
            const resTicket = await dbAsync.run(`
              INSERT INTO pick_tickets (ticket_no, customer_order_no, qty_in_pick_ticket, picker_id, party_code, party_name, route, salesman, date, time, status, warehouse_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [ticketNo, r['Customer Order'] || '-', pickQty, r['Picker'] || '-', pCode, pName, route, salesman, pickDate, pickTime, status, activeWhId]);
            ticketId = resTicket.id;
          }

          // Insert linked Billing if exists
          const billNo = r['Bill No'] && r['Bill No'] !== '-' ? String(r['Bill No']).trim() : null;
          if (billNo && ticketId) {
            const exBill = await dbAsync.get('SELECT id FROM billings WHERE bill_no = ? AND warehouse_id = ?', [billNo, activeWhId]);
            if (!exBill) {
              const billedQty = parseInt(r['Billed Qty'], 10) || 0;
              const invAmount = parseFloat(r['Invoice Amount (Rs.)']) || 0;
              const billDate = r['Billing Date'] ? String(r['Billing Date']).trim() : pickDate;
              const billTime = r['Bill Created Timestamp'] ? String(r['Bill Created Timestamp']).split(' ')[1] || '12:00:00' : '12:00:00';

              // Calculate Short / Excess / Damage based on Pick Qty vs Billed Qty
              const diff = pickQty - billedQty;
              const shortQty = diff > 0 ? diff : 0;
              const excessQty = diff < 0 ? Math.abs(diff) : 0;
              const damageQty = parseInt(r['Damage Qty'] || r['Damage'] || 0, 10);

              await dbAsync.run(`
                INSERT INTO billings (pick_ticket_id, bill_no, billed_qty, invoice_amount, short_qty, excess_qty, damage_qty, checker_id, helper_id, billing_date, billing_time, warehouse_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [ticketId, billNo, billedQty, invAmount, shortQty, excessQty, damageQty, r['Checker'] || '-', r['Helper'] || '-', billDate, billTime, activeWhId]);
            }
          }

          imported++;
        }

        return res.json({
          message: `🎉 Successfully imported full end-to-end dataset (${imported} rows) across Routes, Salesmen, Parties, Pick Tickets, and Billings!`,
          count: imported
        });
      } else {
        // Standard pick ticket import
        for (const r of rows) {
          const ticketNo = r['Ticket No'] || r['TicketNo'] || `PKT-${Math.floor(1000 + Math.random() * 9000)}`;
          await dbAsync.run(`
            INSERT INTO pick_tickets (ticket_no, customer_order_no, party_code, warehouse_id, status, total_cartons)
            VALUES (?, ?, ?, ?, 'Pending', ?)
          `, [ticketNo, r['Order No'] || null, r['Party Code'] || 'PTY-1001', whId, parseInt(r['Cartons'] || 1, 10)]);
          imported++;
        }
      }
    } else if (entity_type === 'Parties') {
      for (const r of rows) {
        const pCode = (r['Party Code'] || r['PartyCode'] || `PTY-${Math.floor(1000 + Math.random() * 9000)}`).trim().toUpperCase();
        const pName = r['Party Name'] || r['PartyName'] || r['Name'] || 'Party';
        const route = r['Route'] || r['Route Name'] || 'Direct Route';
        const salesman = r['Salesman'] || 'General Sales';
        const phone = r['Phone'] || r['Mobile'] || '';
        const gstin = r['GSTIN'] || r['Gstin'] || '';

        const existing = await dbAsync.get('SELECT id FROM parties WHERE party_code = ? AND warehouse_id = ?', [pCode, whId]);
        if (!existing) {
          await dbAsync.run(`
            INSERT INTO parties (party_code, party_name, route_name, salesman, phone, gstin, warehouse_id, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
          `, [pCode, pName, route, salesman, phone, gstin, whId]);
          imported++;
        }
      }
    } else if (entity_type === 'Drivers') {
      for (const r of rows) {
        const dName = r['Driver Name'] || r['Name'] || 'Driver';
        await dbAsync.run(`
          INSERT INTO drivers (name, driver_name, phone, mobile, license_no, status, warehouse_id)
          VALUES (?, ?, ?, ?, ?, 'Available', ?)
        `, [dName, dName, r['Phone'] || '', r['Phone'] || '', r['License No'] || r['License'] || '', whId]);
        imported++;
      }
    } else if (entity_type === 'Vehicles') {
      for (const r of rows) {
        const vNum = (r['Vehicle Number'] || r['VehicleNo'] || `VEH-${Math.floor(1000 + Math.random() * 9000)}`).trim().toUpperCase();
        const existing = await dbAsync.get('SELECT id FROM vehicles WHERE vehicle_number = ? AND warehouse_id = ?', [vNum, whId]);
        if (!existing) {
          await dbAsync.run(`
            INSERT INTO vehicles (vehicle_number, capacity_tons, status, warehouse_id)
            VALUES (?, ?, 'Available', ?)
          `, [vNum, parseFloat(r['Capacity Tons'] || r['Capacity'] || 5.0), whId]);
          imported++;
        }
      }
    } else {
      return res.status(400).json({ message: 'Invalid entity type for import.' });
    }

    return res.json({
      message: `Successfully imported ${imported} records for ${entity_type}!`,
      count: imported
    });
  } catch (err) {
    console.error('Import error:', err);
    return res.status(500).json({ message: 'Error processing Excel import.' });
  }
}

module.exports = {
  importExcel
};
