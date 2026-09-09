const xlsx = require('xlsx');
const { dbAsync } = require('../config/db');

async function getEWayBills(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const ewayBills = await dbAsync.all(`
      SELECT e.*, d.dispatch_no
      FROM eway_bills e
      LEFT JOIN dispatches d ON e.dispatch_id = d.id
      WHERE e.warehouse_id = ?
      ORDER BY e.created_at DESC
    `, [whId]);

    return res.json(ewayBills);
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching E-Way Bills.' });
  }
}

async function uploadExcel(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Excel file is required.' });
    }

    const whId = req.activeWarehouseId;
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let importedCount = 0;

    for (const row of sheetData) {
      const docNo = row['Doc No'] || row['Invoice No'] || row['DocNo'] || `DOC-${Date.now()}`;
      const partyName = row['Party Name'] || row['Customer Name'] || row['PartyName'] || 'Generic Party';
      const gstin = row['GSTIN'] || row['Gstin'] || '';
      const totalVal = parseFloat(row['Total Value'] || row['TotalValue'] || row['Invoice Amount'] || 0);
      const taxableVal = parseFloat(row['Taxable Value'] || row['TaxableValue'] || (totalVal * 0.85).toFixed(2));
      const cgst = parseFloat(row['CGST'] || (taxableVal * 0.09).toFixed(2));
      const sgst = parseFloat(row['SGST'] || (taxableVal * 0.09).toFixed(2));
      const igst = parseFloat(row['IGST'] || 0);
      const ewbNo = row['EWB No'] || row['EWayBillNo'] || `EWB-${Math.floor(100000000000 + Math.random() * 900000000000)}`;

      await dbAsync.run(`
        INSERT INTO eway_bills (ewb_no, ewb_date, doc_no, doc_date, party_name, gstin, hsn_code, total_value, taxable_value, cgst_value, sgst_value, igst_value, quantity, status, warehouse_id)
        VALUES (?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Generated', ?)
      `, [ewbNo, docNo, partyName, gstin, row['HSN'] || '8528', totalVal, taxableVal, cgst, sgst, igst, row['Quantity'] || 1, whId]);

      importedCount++;
    }

    return res.json({
      message: `Successfully processed ${importedCount} E-Way Bill records from Excel!`,
      count: importedCount
    });
  } catch (err) {
    console.error('E-Way Bill Excel upload error:', err);
    return res.status(500).json({ message: 'Error processing E-Way Bill Excel file.' });
  }
}

async function exportJson(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const ewayBills = await dbAsync.all('SELECT * FROM eway_bills WHERE warehouse_id = ?', [whId]);

    const jsonExport = {
      version: '1.0.0321',
      billList: ewayBills.map(b => ({
        userGstin: '07AAAAA0000A1Z5',
        supplyType: 'O',
        subSupplyType: '1',
        docType: 'INV',
        docNo: b.doc_no,
        docDate: b.doc_date ? b.doc_date.split('T')[0] : '31/07/2026',
        fromGstin: '07AAAAA0000A1Z5',
        fromTrdName: 'WMS Central Warehouse',
        fromAddr1: 'Sector 62',
        fromPlace: 'Noida',
        fromPincode: 201301,
        fromStateCode: 9,
        toGstin: b.gstin || 'URP',
        toTrdName: b.party_name,
        toAddr1: 'Commercial Complex',
        toPlace: 'Delhi',
        toPincode: 110001,
        toStateCode: 7,
        totalValue: b.total_value,
        cgstValue: b.cgst_value,
        sgstValue: b.sgst_value,
        igstValue: b.igst_value,
        totInvValue: b.total_value,
        mainHsnCode: b.hsn_code || '8528',
        itemList: [
          {
            productName: 'Electronic Goods',
            productDesc: 'Warehouse Supply',
            hsnCode: parseInt(b.hsn_code || '8528', 10),
            quantity: b.quantity || 1,
            qtyUnit: 'NOS',
            taxableAmount: b.taxable_value,
            cgstRate: 9,
            sgstRate: 9,
            igstRate: 0
          }
        ]
      }))
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=EWayBill_Export.json');
    return res.send(JSON.stringify(jsonExport, null, 2));
  } catch (err) {
    return res.status(500).json({ message: 'Error exporting E-Way Bill JSON.' });
  }
}

module.exports = {
  getEWayBills,
  uploadExcel,
  exportJson
};
