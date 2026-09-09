const bcrypt = require('bcryptjs');
const { dbAsync, initDatabase } = require('./config/db');

async function seedData() {
  await initDatabase();

  // Check if parties already exist
  const existingParty = await dbAsync.get('SELECT id FROM parties LIMIT 1');
  if (existingParty) {
    console.log('Database already has seeded data.');
    process.exit(0);
  }

  console.log('Seeding initial enterprise demo data for WMS...');

  // 1. Warehouses
  let wh = await dbAsync.get("SELECT id FROM warehouses WHERE warehouse_code = 'WH-CENTRAL'");
  let whId;
  if (!wh) {
    const whResult = await dbAsync.run(`
      INSERT INTO warehouses (warehouse_code, warehouse_name, address, contact_number, prefix_logic, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, ['WH-CENTRAL', 'Central Logistics Hub', 'Sector 62, Industrial Area, Noida', '+91 98765 43210', 'PIK26-']);
    whId = whResult.id;
  } else {
    whId = wh.id;
  }

  let wh2 = await dbAsync.get("SELECT id FROM warehouses WHERE warehouse_code = 'WH-SOUTH'");
  let whId2;
  if (!wh2) {
    const whResult2 = await dbAsync.run(`
      INSERT INTO warehouses (warehouse_code, warehouse_name, address, contact_number, prefix_logic, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, ['WH-SOUTH', 'South Metro Hub', 'Okhla Phase 3, New Delhi', '+91 98111 22233', 'PIK26-']);
    whId2 = whResult2.id;
  } else {
    whId2 = wh2.id;
  }

  // 2. Users (Admin, Dispatcher, Driver)
  const passwordHash = await bcrypt.hash('admin123', 10);
  const driverPasswordHash = await bcrypt.hash('driver123', 10);

  const existingAdmin = await dbAsync.get("SELECT id FROM users WHERE username = 'admin'");
  if (!existingAdmin) {
    await dbAsync.run(`
      INSERT INTO users (username, email, password_hash, full_name, role, role_name, warehouse_id, is_active)
      VALUES (?, ?, ?, ?, 'SuperAdmin', 'Super Admin', ?, 1)
    `, ['admin', 'admin@thessbuddy.com', passwordHash, 'System Super Admin', whId]);
  }

  const existingDisp = await dbAsync.get("SELECT id FROM users WHERE username = 'dispatcher1'");
  if (!existingDisp) {
    await dbAsync.run(`
      INSERT INTO users (username, email, password_hash, full_name, role, role_name, warehouse_id, is_active)
      VALUES (?, ?, ?, ?, 'Dispatcher', 'Warehouse Admin', ?, 1)
    `, ['dispatcher1', 'dispatch@thessbuddy.com', passwordHash, 'Rahul Sharma (Dispatcher)', whId]);
  }

  const existingDriverUser = await dbAsync.get("SELECT id FROM users WHERE username = 'driver_rajesh'");
  if (!existingDriverUser) {
    await dbAsync.run(`
      INSERT INTO users (username, email, password_hash, full_name, role, role_name, warehouse_id, is_active)
      VALUES (?, ?, ?, ?, 'Driver', 'Operator', ?, 1)
    `, ['driver_rajesh', 'rajesh@thessbuddy.com', driverPasswordHash, 'Rajesh Kumar (Driver)', whId]);
  }

  // 3. Route Masters
  const route1 = await dbAsync.run(`
    INSERT INTO route_masters (route_code, route_name, warehouse_id)
    VALUES (?, ?, ?)
  `, ['RT-NORTH-01', 'North Delhi Express Route', whId]);

  const route2 = await dbAsync.run(`
    INSERT INTO route_masters (route_code, route_name, warehouse_id)
    VALUES (?, ?, ?)
  `, ['RT-WEST-02', 'Gurgaon - Manesar Industrial Line', whId]);

  // 4. Staff / Workers (Pickers, Checkers, Helpers)
  const picker1 = await dbAsync.run(`
    INSERT INTO picker_checker_helpers (employee_code, name, role, role_type, phone, mobile, warehouse_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `, ['EMP-PK-01', 'Amit Verma', 'Picker', 'Picker', '+91 99887 11223', '+91 99887 11223', whId]);

  const picker2 = await dbAsync.run(`
    INSERT INTO picker_checker_helpers (employee_code, name, role, role_type, phone, mobile, warehouse_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `, ['EMP-PK-02', 'Suresh Kumar', 'Picker', 'Picker', '+91 99887 22334', '+91 99887 22334', whId]);

  const checker1 = await dbAsync.run(`
    INSERT INTO picker_checker_helpers (employee_code, name, role, role_type, phone, mobile, warehouse_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `, ['EMP-CK-01', 'Vikas Singh', 'Checker', 'Checker', '+91 99887 33445', '+91 99887 33445', whId]);

  const helper1 = await dbAsync.run(`
    INSERT INTO picker_checker_helpers (employee_code, name, role, role_type, phone, mobile, warehouse_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `, ['EMP-HL-01', 'Deepak Yadav', 'Helper', 'Helper', '+91 99887 44556', '+91 99887 44556', whId]);

  // 5. Drivers & Vehicles
  const driver1 = await dbAsync.run(`
    INSERT INTO drivers (driver_name, name, phone, mobile, license_number, license_no, status, warehouse_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `, ['Rajesh Kumar', 'Rajesh Kumar', '+91 98765 00001', '+91 98765 00001', 'DL-0420210098', 'DL-0420210098', 'In Transit', whId]);

  const driver2 = await dbAsync.run(`
    INSERT INTO drivers (driver_name, name, phone, mobile, license_number, license_no, status, warehouse_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `, ['Sunil Rawat', 'Sunil Rawat', '+91 98765 00002', '+91 98765 00002', 'DL-0420210099', 'DL-0420210099', 'Available', whId]);

  const vehicle1 = await dbAsync.run(`
    INSERT INTO vehicles (vehicle_number, vehicle_type, driver_id, capacity_tons, status, warehouse_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `, ['DL-01-AB-1234', 'Truck', driver1.id, 7.5, 'In Transit', whId]);

  const vehicle2 = await dbAsync.run(`
    INSERT INTO vehicles (vehicle_number, vehicle_type, driver_id, capacity_tons, status, warehouse_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `, ['DL-02-CD-5678', 'Van', driver2.id, 10.0, 'Available', whId]);

  // 6. Salesmen
  await dbAsync.run(`
    INSERT INTO salesman_masters (salesman_code, salesman_name, mobile, phone, territory, warehouse_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `, ['SLS-01', 'Vikram Malhotra', '+91 98100 55443', '+91 98100 55443', 'North Delhi Region', whId]);

  await dbAsync.run(`
    INSERT INTO salesmen (salesman_code, name, phone, territory)
    VALUES (?, ?, ?, ?)
  `, ['SLS-01', 'Vikram Malhotra', '+91 98100 55443', 'North Delhi Region']);

  // 7. Parties (Customers)
  await dbAsync.run(`
    INSERT INTO parties (party_code, party_name, address, city, phone, gstin, credit_limit, salesman, route_name, warehouse_id, route_id, lat, lng, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `, ['PTY-1001', 'Apex Electronics Pvt Ltd', 'Plot 45, Okhla Phase 1', 'New Delhi', '+91 11 4100 2000', '07AAAAA0000A1Z5', 500000, 'Vikram Malhotra', 'North Delhi Express Route', whId, route1.id, 28.5355, 77.2680]);

  await dbAsync.run(`
    INSERT INTO parties (party_code, party_name, address, city, phone, gstin, credit_limit, salesman, route_name, warehouse_id, route_id, lat, lng, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `, ['PTY-1002', 'Metro Traders & Retail', 'Connaught Place Block M', 'New Delhi', '+91 11 2341 5566', '07BBBBB1111B1Z2', 800000, 'Vikram Malhotra', 'North Delhi Express Route', whId, route1.id, 28.6315, 77.2167]);

  await dbAsync.run(`
    INSERT INTO parties (party_code, party_name, address, city, phone, gstin, credit_limit, salesman, route_name, warehouse_id, route_id, lat, lng, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `, ['PTY-1003', 'Sunrise Logistics & Distribution', 'Sector 18 Market', 'Noida', '+91 120 4567 890', '09CCCCC2222C1Z9', 1200000, 'Vikram Malhotra', 'Gurgaon - Manesar Industrial Line', whId, route2.id, 28.5708, 77.3260]);

  // 8. Pick Tickets & Billings
  const today = new Date().toISOString().split('T')[0];
  const ticket1 = await dbAsync.run(`
    INSERT INTO pick_tickets (date, time, ticket_no, customer_order_no, qty_in_pick_ticket, picker_id,
      party_code, party_name, route, salesman, priority, remarks, status, warehouse_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [today, '09:00', 'PKT-2026-001', 'ORD-9901', 5, picker1.id,
      'PTY-1001', 'Apex Electronics Pvt Ltd', 'North Delhi Express Route', 'Vikram Malhotra',
      'Normal', 'Handle fragile items carefully', 'Dispatched', whId, 'admin']);

  const ticket2 = await dbAsync.run(`
    INSERT INTO pick_tickets (date, time, ticket_no, customer_order_no, qty_in_pick_ticket, picker_id,
      party_code, party_name, route, salesman, priority, remarks, status, warehouse_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [today, '10:30', 'PKT-2026-002', 'ORD-9902', 10, picker2.id,
      'PTY-1002', 'Metro Traders & Retail', 'North Delhi Express Route', 'Vikram Malhotra',
      'High', '', 'Dispatched', whId, 'admin']);

  const ticket3 = await dbAsync.run(`
    INSERT INTO pick_tickets (date, time, ticket_no, customer_order_no, qty_in_pick_ticket, picker_id,
      party_code, party_name, route, salesman, priority, remarks, status, warehouse_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [today, '11:00', 'PKT-2026-003', 'ORD-9903', 3, picker1.id,
      'PTY-1003', 'Sunrise Logistics & Distribution', 'Gurgaon - Manesar Industrial Line', 'Vikram Malhotra',
      'Normal', '', 'Assigned', whId, 'admin']);

  const bill1 = await dbAsync.run(`
    INSERT INTO billings (bill_no, billing_date, billing_time, pick_ticket_id, billed_qty, invoice_amount, checker_id, helper_id, warehouse_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['INV-2026-101', today, '09:30', ticket1.id, 5, 450000, checker1.id, helper1.id, whId]);

  const bill2 = await dbAsync.run(`
    INSERT INTO billings (bill_no, billing_date, billing_time, pick_ticket_id, billed_qty, invoice_amount, checker_id, helper_id, warehouse_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['INV-2026-102', today, '11:00', ticket2.id, 10, 820000, checker1.id, helper1.id, whId]);

  const bill3 = await dbAsync.run(`
    INSERT INTO billings (bill_no, billing_date, billing_time, pick_ticket_id, billed_qty, invoice_amount, checker_id, helper_id, warehouse_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['INV-2026-103', today, '11:30', ticket3.id, 3, 150000, checker1.id, helper1.id, whId]);

  // 9. Dispatch & Dispatch Parties & Cartons
  const dispatch1 = await dbAsync.run(`
    INSERT INTO dispatches (dispatch_no, route, driver_id, vehicle_id, warehouse_id, status, total_cartons, scanned_cartons, total_amount, started_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, ['DSP-2026-8801', 'North Delhi Express Route', driver1.id, vehicle1.id, whId, 'In Transit', 15, 15, 1270000]);

  const dp1 = await dbAsync.run(`
    INSERT INTO dispatch_parties (dispatch_id, party_code, party_name, billing_id, warehouse_id, status, total_cartons, scanned_cartons)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [dispatch1.id, 'PTY-1001', 'Apex Electronics Pvt Ltd', bill1.id, whId, 'In Transit', 5, 5]);

  const dp2 = await dbAsync.run(`
    INSERT INTO dispatch_parties (dispatch_id, party_code, party_name, billing_id, warehouse_id, status, total_cartons, scanned_cartons)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [dispatch1.id, 'PTY-1002', 'Metro Traders & Retail', bill2.id, whId, 'In Transit', 10, 10]);

  // Cartons for Dispatch 1
  for (let i = 1; i <= 5; i++) {
    await dbAsync.run(`
      INSERT INTO cartons (barcode_no, dispatch_party_id, dispatch_id, warehouse_id, is_scanned, scanned_at)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `, [`CTN-1001-${i}`, dp1.id, dispatch1.id, whId]);
  }
  for (let i = 1; i <= 10; i++) {
    await dbAsync.run(`
      INSERT INTO cartons (barcode_no, dispatch_party_id, dispatch_id, warehouse_id, is_scanned, scanned_at)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `, [`CTN-1002-${i}`, dp2.id, dispatch1.id, whId]);
  }

  // 10. E-Way Bills
  await dbAsync.run(`
    INSERT INTO eway_bills (ewb_no, ewb_date, doc_no, doc_date, party_name, gstin, hsn_code, total_value, taxable_value, cgst_value, sgst_value, igst_value, quantity, status, dispatch_id, warehouse_id)
    VALUES (?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['EWB-9988-7711-01', 'INV-2026-101', 'Apex Electronics Pvt Ltd', '07AAAAA0000A1Z5', '8528', 450000, 381355.93, 34322.03, 34322.03, 0, 45, 'Assigned', dispatch1.id, whId]);

  await dbAsync.run(`
    INSERT INTO eway_bills (ewb_no, ewb_date, doc_no, doc_date, party_name, gstin, hsn_code, total_value, taxable_value, cgst_value, sgst_value, igst_value, quantity, status, dispatch_id, warehouse_id)
    VALUES (?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['EWB-9988-7711-02', 'INV-2026-102', 'Metro Traders & Retail', '07BBBBB1111B1Z2', '8528', 820000, 694915.25, 62542.37, 62542.37, 0, 120, 'Assigned', dispatch1.id, whId]);

  // 11. Initial Notifications
  await dbAsync.run(`
    INSERT INTO notifications (message, type, warehouse_id)
    VALUES (?, ?, ?)
  `, ['Dispatch DSP-2026-8801 is currently In Transit on Vehicle DL-01-AB-1234.', 'Info', whId]);

  await dbAsync.run(`
    INSERT INTO notifications (message, type, warehouse_id)
    VALUES (?, ?, ?)
  `, ['High-priority pick ticket PKT-2026-003 is picked and ready for billing.', 'Success', whId]);

  // 12. Performance logs
  await dbAsync.run(`
    INSERT INTO performance_logs (worker_name, role, task_count, warehouse_id)
    VALUES (?, ?, ?, ?)
  `, ['Amit Verma', 'Picker', 42, whId]);

  await dbAsync.run(`
    INSERT INTO performance_logs (worker_name, role, task_count, warehouse_id)
    VALUES (?, ?, ?, ?)
  `, ['Vikas Singh', 'Checker', 68, whId]);

  console.log('✅ Enterprise demo data seeded successfully in MySQL database!');
  process.exit(0);
}

seedData().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});

