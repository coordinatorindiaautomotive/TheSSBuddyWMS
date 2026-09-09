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

    if (entity_type === 'Parties') {
      for (const r of rows) {
        const partyCode = r['Party Code'] || r['PartyCode'] || `PTY-${Math.floor(1000 + Math.random() * 9000)}`;
        await dbAsync.run(`
          INSERT INTO parties (party_code, party_name, address, city, phone, gstin, credit_limit, warehouse_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [partyCode, r['Party Name'] || r['PartyName'], r['Address'] || '', r['City'] || 'Delhi', r['Phone'] || '', r['GSTIN'] || '', parseFloat(r['Credit Limit'] || 0), whId]);
        imported++;
      }
    } else if (entity_type === 'PickTickets') {
      for (const r of rows) {
        const ticketNo = r['Ticket No'] || r['TicketNo'] || `PKT-${Math.floor(1000 + Math.random() * 9000)}`;
        await dbAsync.run(`
          INSERT INTO pick_tickets (ticket_no, customer_order_no, party_code, warehouse_id, status, total_cartons)
          VALUES (?, ?, ?, ?, 'Pending', ?)
        `, [ticketNo, r['Order No'] || null, r['Party Code'] || 'PTY-1001', whId, parseInt(r['Cartons'] || 1, 10)]);
        imported++;
      }
    } else if (entity_type === 'Drivers') {
      for (const r of rows) {
        await dbAsync.run(`
          INSERT INTO drivers (name, phone, license_no, status, warehouse_id)
          VALUES (?, ?, ?, 'Available', ?)
        `, [r['Driver Name'] || r['Name'], r['Phone'], r['License No'] || '', whId]);
        imported++;
      }
    } else if (entity_type === 'Vehicles') {
      for (const r of rows) {
        await dbAsync.run(`
          INSERT INTO vehicles (vehicle_number, capacity_tons, status, warehouse_id)
          VALUES (?, ?, 'Available', ?)
        `, [r['Vehicle Number'] || r['VehicleNo'], parseFloat(r['Capacity Tons'] || 5.0), whId]);
        imported++;
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
