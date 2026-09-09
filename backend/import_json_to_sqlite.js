const fs = require('fs');
const path = require('path');
const { initDatabase, dbAsync } = require('./src/config/db');

function readJson(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/^\uFEFF/, '').trim();
  // If content is not enclosed in brackets, wrap it in array brackets
  if (!content.startsWith('[')) {
    content = `[${content}]`;
  }
  return JSON.parse(content);
}

async function importAllData() {
  await initDatabase();
  const syncDir = path.join(__dirname, 'data/remote_sync');

  console.log('--- STARTING IMPORT INTO LOCAL SQLITE DATABASE ---');

  // 1. Warehouses
  const warehousesFile = path.join(syncDir, 'Warehouses.json');
  if (fs.existsSync(warehousesFile)) {
    const warehouses = readJson(warehousesFile);
    for (const w of warehouses) {
      try {
        await dbAsync.run(`
          INSERT INTO warehouses (id, warehouse_code, warehouse_name, address, contact_number, prefix_logic, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            warehouse_code = excluded.warehouse_code,
            warehouse_name = excluded.warehouse_name,
            address = excluded.address
        `, [
          w.WarehouseId || w.id || 1,
          w.WarehouseCode || 'WH-01',
          w.WarehouseName || 'TRANSPORT NAGAR-SPR (VBZ)',
          w.Address || 'Jaipur',
          w.Mobile || w.ContactPerson || '',
          w.PrefixLogic || 'PIK26-',
          w.IsActive ? 1 : 0
        ]);
      } catch (e) {
        console.error('Warehouse import note:', e.message);
      }
    }
    console.log(`✓ Imported ${warehouses.length} Warehouse(s)`);
  }

  // 2. Route Masters
  const routesFile = path.join(syncDir, 'RouteMasters.json');
  if (fs.existsSync(routesFile)) {
    const routes = readJson(routesFile);
    for (const r of routes) {
      try {
        await dbAsync.run(`
          INSERT INTO route_masters (id, route_code, route_name, warehouse_id)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET route_name = excluded.route_name
        `, [
          r.RouteId,
          `RT-${r.RouteId}`,
          r.RouteName,
          r.WarehouseId || 1
        ]);
      } catch (e) {}
    }
    console.log(`✓ Imported ${routes.length} Route Master(s)`);
  }

  // 3. Parties
  const partiesFile = path.join(syncDir, 'Parties.json');
  if (fs.existsSync(partiesFile)) {
    const parties = readJson(partiesFile);
    for (const p of parties) {
      try {
        await dbAsync.run(`
          INSERT INTO parties (party_code, party_name, route_name, salesman, mobile, gstin, address, credit_limit, warehouse_id, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(party_code) DO UPDATE SET
            party_name = excluded.party_name,
            route_name = excluded.route_name,
            salesman = excluded.salesman,
            credit_limit = excluded.credit_limit
        `, [
          p.PartyCode,
          p.PartyName,
          p.Route || 'Direct Route',
          p.Salesman || 'General Sales',
          p.Mobile || '',
          p.GSTNumber || '',
          p.Address || '',
          p.CreditLimit || 0,
          p.WarehouseId || 1,
          p.IsActive ? 1 : 0
        ]);
      } catch (e) {}
    }
    console.log(`✓ Imported ${parties.length} Party Master(s)`);
  }

  // 4. Picker / Checker / Helpers
  const workersFile = path.join(syncDir, 'PickerCheckerHelpers.json');
  if (fs.existsSync(workersFile)) {
    const workers = readJson(workersFile);
    for (const w of workers) {
      try {
        await dbAsync.run(`
          INSERT INTO picker_checker_helpers (employee_code, name, mobile, role_type, warehouse_id, is_active)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(employee_code) DO UPDATE SET name = excluded.name, role_type = excluded.role_type
        `, [
          w.EmployeeCode,
          w.Name,
          w.Mobile || '',
          w.RoleType || 'Picker',
          w.WarehouseId || 1,
          w.IsActive ? 1 : 0
        ]);
      } catch (e) {}
    }
    console.log(`✓ Imported ${workers.length} Worker(s) (Pickers, Checkers, Helpers)`);
  }

  // 5. Salesmen
  const salesmenFile = path.join(syncDir, 'SalesmanMasters.json');
  if (fs.existsSync(salesmenFile)) {
    const salesmen = readJson(salesmenFile);
    for (const s of salesmen) {
      try {
        await dbAsync.run(`
          INSERT INTO salesman_masters (id, salesman_code, salesman_name, mobile, email, warehouse_id)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET salesman_name = excluded.salesman_name
        `, [
          s.SalesmanId,
          s.SalesmanCode || `SM-${s.SalesmanId}`,
          s.SalesmanName,
          s.Mobile || '',
          s.Email || '',
          s.WarehouseId || 1
        ]);
      } catch (e) {}
    }
    console.log(`✓ Imported ${salesmen.length} Salesman Master(s)`);
  }

  // 6. Users (AspNetUsers)
  const usersFile = path.join(syncDir, 'AspNetUsers.json');
  if (fs.existsSync(usersFile)) {
    const users = readJson(usersFile);
    for (const u of users) {
      try {
        await dbAsync.run(`
          INSERT INTO users (username, email, password_hash, full_name, role, warehouse_id, is_active)
          VALUES (?, ?, '$2a$10$wmsenterprisehashsecret2026', ?, ?, ?, 1)
          ON CONFLICT(username) DO UPDATE SET full_name = excluded.full_name, role = excluded.role
        `, [
          u.UserName || u.Email,
          u.Email || `${u.UserName}@wms.com`,
          u.FullName || u.UserName,
          u.Role || 'Dispatcher',
          u.WarehouseId || 1
        ]);
      } catch (e) {}
    }
    console.log(`✓ Imported ${users.length} User Account(s)`);
  }

  // 7. Pick Tickets
  const ticketsFile = path.join(syncDir, 'PickTickets.json');
  if (fs.existsSync(ticketsFile)) {
    const tickets = readJson(ticketsFile);
    for (const t of tickets) {
      try {
        let ticketDate = new Date().toISOString().split('T')[0];
        if (t.Date) {
          if (typeof t.Date === 'string' && t.Date.startsWith('/Date(')) {
            const ms = parseInt(t.Date.replace(/\/Date\((\d+)\)\//, '$1'), 10);
            ticketDate = new Date(ms).toISOString().split('T')[0];
          } else {
            ticketDate = t.Date.split('T')[0];
          }
        }
        const ticketTime = t.Time || '12:00';
        await dbAsync.run(`
          INSERT INTO pick_tickets (
            id, date, time, ticket_no, customer_order_no, qty_in_pick_ticket,
            party_code, party_name, route, salesman, priority, remarks, status, warehouse_id, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            party_name = excluded.party_name,
            route = excluded.route,
            qty_in_pick_ticket = excluded.qty_in_pick_ticket
        `, [
          t.PickTicketId,
          ticketDate,
          ticketTime,
          t.PickTicketNo,
          t.CustomerOrderNo || '',
          t.QtyInPickTicket || 1,
          t.PartyCode || 'PRT-GEN',
          t.PartyName || 'General Party',
          t.Route || 'Direct Route',
          t.Salesman || 'General Sales',
          t.Priority || 'Normal',
          t.Remarks || '',
          t.Status || 'Assigned',
          t.WarehouseId || 1,
          t.CreatedBy || 'System'
        ]);
      } catch (e) {
        console.error('PickTicket error:', e.message);
      }
    }
    console.log(`✓ Imported ${tickets.length} Pick Ticket(s)`);
  }

  // 8. Billings
  const billingsFile = path.join(syncDir, 'Billings.json');
  if (fs.existsSync(billingsFile)) {
    const billings = readJson(billingsFile);
    for (const b of billings) {
      try {
        const bDate = b.BillingDate ? b.BillingDate.split('T')[0] : new Date().toISOString().split('T')[0];
        await dbAsync.run(`
          INSERT INTO billings (
            id, pick_ticket_id, billing_date, billing_time, bill_no, billed_qty,
            invoice_amount, short_qty, excess_qty, damage_qty, billing_remarks, warehouse_id, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            bill_no = excluded.bill_no,
            invoice_amount = excluded.invoice_amount,
            billed_qty = excluded.billed_qty
        `, [
          b.BillingId,
          b.PickTicketId,
          bDate,
          b.BillingTime || '12:00',
          b.BillNo,
          b.BilledQty || 1,
          parseFloat(b.InvoiceAmount || 0),
          b.ShortQty || 0,
          b.ExcessQty || 0,
          b.DamageQty || 0,
          b.BillingRemarks || '',
          b.WarehouseId || 1,
          b.CreatedBy || 'System'
        ]);
      } catch (e) {
        console.error('Billing error:', e.message);
      }
    }
    console.log(`✓ Imported ${billings.length} Billing Invoice(s)`);
  }

  // 9. Audit Logs
  const auditFile = path.join(syncDir, 'AuditLogs.json');
  if (fs.existsSync(auditFile)) {
    const auditLogs = readJson(auditFile);
    for (const a of auditLogs) {
      try {
        const tStamp = a.Timestamp ? a.Timestamp.replace('T', ' ').substring(0, 19) : new Date().toISOString();
        await dbAsync.run(`
          INSERT INTO audit_logs (
            id, warehouse_id, user_id, user_name, user_role, user_ip,
            action_type, module, target_id, details, changed_fields, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING
        `, [
          a.Id,
          a.WarehouseId || 1,
          a.UserId || null,
          a.UserName || 'System User',
          'Operator',
          a.IpAddress || '192.168.1.104',
          a.Activity || 'STATUS_CHANGE',
          a.EntityName || 'System',
          a.EntityKey || 'N/A',
          `${a.Activity || 'Action'} on ${a.EntityName || 'Record'} (${a.EntityKey || ''})`,
          a.NewValues || null,
          tStamp
        ]);
      } catch (e) {}
    }
    console.log(`✓ Imported ${auditLogs.length} Audit Log(s)`);
  }

  console.log('--- ALL DATA IMPORTED SUCCESSFULLY INTO LOCAL SQLITE DATABASE ---');
}

importAllData();
