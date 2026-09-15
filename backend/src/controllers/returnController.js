const { dbAsync } = require('../config/db');

async function ensureReturnsTable() {
  try {
    await dbAsync.exec(`
      CREATE TABLE IF NOT EXISTS returns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        return_no VARCHAR(100) UNIQUE NOT NULL,
        ref_invoice_no VARCHAR(100) NULL,
        ref_invoice_date VARCHAR(50) NULL,
        return_date VARCHAR(50) NOT NULL,
        party_code VARCHAR(100) NOT NULL,
        party_name VARCHAR(255) NOT NULL,
        remark_id INT NULL,
        remark_name VARCHAR(255) NULL,
        is_dms_received TINYINT DEFAULT 0,
        str_no VARCHAR(100) NULL,
        status VARCHAR(50) DEFAULT 'Pending DMS',
        total_qty INT DEFAULT 0,
        total_value DECIMAL(12,2) DEFAULT 0.00,
        internal_remarks TEXT,
        attachment_url TEXT,
        warehouse_id INT NOT NULL,
        created_by VARCHAR(100) DEFAULT 'System',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await dbAsync.exec(`
      CREATE TABLE IF NOT EXISTS return_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        return_id INT NOT NULL,
        part_no VARCHAR(100) NOT NULL,
        part_name VARCHAR(255) NOT NULL,
        reference_invoice_no VARCHAR(100) NULL,
        qty INT NOT NULL DEFAULT 1,
        rate DECIMAL(10,2) DEFAULT 0.00,
        value DECIMAL(12,2) DEFAULT 0.00,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (return_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (e) {
    try {
      await dbAsync.exec(`
        CREATE TABLE IF NOT EXISTS returns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          return_no TEXT UNIQUE NOT NULL,
          ref_invoice_no TEXT,
          ref_invoice_date TEXT,
          return_date TEXT NOT NULL,
          party_code TEXT NOT NULL,
          party_name TEXT NOT NULL,
          remark_id INTEGER,
          remark_name TEXT,
          is_dms_received INTEGER DEFAULT 0,
          str_no TEXT,
          status TEXT DEFAULT 'Pending DMS',
          total_qty INTEGER DEFAULT 0,
          total_value REAL DEFAULT 0,
          internal_remarks TEXT,
          attachment_url TEXT,
          warehouse_id INTEGER NOT NULL,
          created_by TEXT DEFAULT 'System',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME
        );
      `);
      await dbAsync.exec(`
        CREATE TABLE IF NOT EXISTS return_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          return_id INTEGER NOT NULL,
          part_no TEXT NOT NULL,
          part_name TEXT NOT NULL,
          reference_invoice_no TEXT,
          qty INTEGER NOT NULL DEFAULT 1,
          rate REAL DEFAULT 0,
          value REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e2) {}
  }
}

// Suggest next Return Number (e.g. RET-20260914-0001)
async function suggestNextNo(req, res) {
  try {
    await ensureReturnsTable();
    const whId = req.activeWarehouseId || 1;
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `RET-${dateStr}-`;

    const lastReturn = await dbAsync.get(`
      SELECT return_no FROM returns 
      WHERE return_no LIKE ? AND warehouse_id = ?
      ORDER BY id DESC LIMIT 1
    `, [`${prefix}%`, whId]);

    let seq = 1;
    if (lastReturn && lastReturn.return_no) {
      const parts = lastReturn.return_no.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    const suggestedNo = `${prefix}${String(seq).padStart(4, '0')}`;
    return res.json({ suggestedNo });
  } catch (err) {
    console.error('suggestNextNo error:', err);
    return res.status(500).json({ message: 'Error generating return number.' });
  }
}

// Get all Returns with filtering and pagination
async function getReturns(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const {
      search = '',
      party = '',
      is_dms = '',
      status = '',
      from_date = '',
      to_date = '',
      page = 1,
      limit = 50
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (parsedPage - 1) * parsedLimit;

    let whereClause = 'WHERE r.warehouse_id = ?';
    const params = [whId];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      whereClause += ' AND (r.return_no LIKE ? OR r.ref_invoice_no LIKE ? OR r.party_name LIKE ? OR r.party_code LIKE ? OR r.str_no LIKE ? OR r.remark_name LIKE ?)';
      params.push(s, s, s, s, s, s);
    }

    if (party && party.trim()) {
      whereClause += ' AND (r.party_code = ? OR r.party_name = ?)';
      params.push(party.trim(), party.trim());
    }

    if (is_dms !== '') {
      whereClause += ' AND r.is_dms_received = ?';
      params.push(parseInt(is_dms, 10));
    }

    if (status && status.trim()) {
      whereClause += ' AND r.status = ?';
      params.push(status.trim());
    }

    if (from_date && from_date.trim()) {
      whereClause += ' AND r.return_date >= ?';
      params.push(from_date.trim());
    }

    if (to_date && to_date.trim()) {
      whereClause += ' AND r.return_date <= ?';
      params.push(to_date.trim());
    }

    const countSql = `SELECT COUNT(*) as total FROM returns r ${whereClause}`;
    const countRow = await dbAsync.get(countSql, params);
    const totalRecords = countRow?.total || 0;

    const dataSql = `
      SELECT 
        r.*,
        (SELECT COUNT(*) FROM return_items WHERE return_id = r.id) as item_count
      FROM returns r
      ${whereClause}
      ORDER BY r.id DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await dbAsync.all(dataSql, [...params, parsedLimit, offset]);

    return res.json({
      data: rows || [],
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / parsedLimit) || 1
      }
    });
  } catch (err) {
    console.error('getReturns error:', err);
    return res.status(500).json({ message: 'Error fetching returns.' });
  }
}

// Get single Return by ID with item rows
async function getReturnById(req, res) {
  try {
    const { id } = req.params;
    const ret = await dbAsync.get('SELECT * FROM returns WHERE id = ?', [id]);
    if (!ret) {
      return res.status(404).json({ message: 'Return record not found.' });
    }

    const items = await dbAsync.all('SELECT * FROM return_items WHERE return_id = ? ORDER BY id ASC', [id]);
    return res.json({
      ...ret,
      items: items || []
    });
  } catch (err) {
    console.error('getReturnById error:', err);
    return res.status(500).json({ message: 'Error fetching return details.' });
  }
}

// Create new Return
async function createReturn(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const user = req.user?.full_name || req.user?.username || 'System';

    let {
      return_no,
      ref_invoice_no,
      ref_invoice_date,
      return_date,
      party_code,
      party_name,
      remark_id,
      remark_name,
      is_dms_received = 0,
      str_no,
      status,
      internal_remarks,
      attachment_url,
      items = []
    } = req.body;

    if (!party_code || !party_name) {
      return res.status(400).json({ message: 'Party information is required.' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one return part item is required.' });
    }

    // DMS validations
    const isDms = is_dms_received ? 1 : 0;
    if (isDms && (!str_no || !str_no.trim())) {
      return res.status(400).json({ message: 'STR No. is required when DMS Received is Yes.' });
    }

    let finalStatus = status;
    if (!finalStatus) {
      finalStatus = isDms ? 'DMS Received' : 'Pending DMS';
    }

    // Auto-generate return_no if missing
    if (!return_no || !return_no.trim()) {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = `RET-${dateStr}-`;
      const last = await dbAsync.get(`SELECT return_no FROM returns WHERE return_no LIKE ? ORDER BY id DESC LIMIT 1`, [`${prefix}%`]);
      let seq = 1;
      if (last && last.return_no) {
        const p = last.return_no.split('-');
        const s = parseInt(p[p.length - 1], 10);
        if (!isNaN(s)) seq = s + 1;
      }
      return_no = `${prefix}${String(seq).padStart(4, '0')}`;
    }

    // Calculate totals
    let totalQty = 0;
    let totalValue = 0;
    const cleanItems = items.map(it => {
      const q = Math.max(1, parseInt(it.qty, 10) || 1);
      const r = Math.max(0, parseFloat(it.rate) || 0);
      const val = parseFloat((q * r).toFixed(2));
      totalQty += q;
      totalValue += val;
      return {
        part_no: (it.part_no || '').trim(),
        part_name: (it.part_name || it.part_no || 'Return Part').trim(),
        reference_invoice_no: (it.reference_invoice_no || ref_invoice_no || '').trim(),
        qty: q,
        rate: r,
        value: val
      };
    });

    const retDate = return_date || new Date().toISOString().slice(0, 10);

    const result = await dbAsync.run(`
      INSERT INTO returns (
        return_no, ref_invoice_no, ref_invoice_date, return_date, party_code, party_name,
        remark_id, remark_name, is_dms_received, str_no,
        status, total_qty, total_value, internal_remarks,
        attachment_url, warehouse_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      return_no.trim(),
      ref_invoice_no ? ref_invoice_no.trim() : null,
      ref_invoice_date ? ref_invoice_date.trim() : null,
      retDate,
      party_code.trim(),
      party_name.trim(),
      remark_id || null,
      remark_name || null,
      isDms,
      str_no ? str_no.trim() : null,
      finalStatus,
      totalQty,
      totalValue,
      internal_remarks || null,
      attachment_url || null,
      whId,
      user
    ]);

    const returnId = result.id;

    // Insert items
    for (const item of cleanItems) {
      await dbAsync.run(`
        INSERT INTO return_items (return_id, part_no, part_name, reference_invoice_no, qty, rate, value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        returnId,
        item.part_no,
        item.part_name,
        item.reference_invoice_no,
        item.qty,
        item.rate,
        item.value
      ]);
    }

    if (req.io) {
      req.io.emit('returnCreated', { id: returnId, return_no, party_name });
    }

    return res.json({
      message: 'Return record created successfully!',
      id: returnId,
      return_no
    });
  } catch (err) {
    console.error('createReturn error:', err);
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ message: 'A return with this Return No. already exists.' });
    }
    return res.status(500).json({ message: err.message || 'Error creating return record.' });
  }
}

// Update Return
async function updateReturn(req, res) {
  try {
    const { id } = req.params;
    const existing = await dbAsync.get('SELECT * FROM returns WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: 'Return record not found.' });
    }

    let {
      return_no,
      ref_invoice_no,
      ref_invoice_date,
      return_date,
      party_code,
      party_name,
      remark_id,
      remark_name,
      is_dms_received,
      str_no,
      status,
      internal_remarks,
      attachment_url,
      items
    } = req.body;

    const isDms = is_dms_received !== undefined ? (is_dms_received ? 1 : 0) : existing.is_dms_received;
    if (isDms && (!str_no || !str_no.trim()) && (!existing.str_no)) {
      return res.status(400).json({ message: 'STR No. is required when DMS Received is Yes.' });
    }

    let finalStatus = status || existing.status;
    if (isDms && finalStatus === 'Pending DMS') {
      finalStatus = 'DMS Received';
    }

    let totalQty = existing.total_qty;
    let totalValue = existing.total_value;

    if (items && Array.isArray(items)) {
      totalQty = 0;
      totalValue = 0;
      await dbAsync.run('DELETE FROM return_items WHERE return_id = ?', [id]);
      for (const it of items) {
        const q = Math.max(1, parseInt(it.qty, 10) || 1);
        const r = Math.max(0, parseFloat(it.rate) || 0);
        const val = parseFloat((q * r).toFixed(2));
        totalQty += q;
        totalValue += val;
        await dbAsync.run(`
          INSERT INTO return_items (return_id, part_no, part_name, reference_invoice_no, qty, rate, value)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
          (it.part_no || '').trim(),
          (it.part_name || it.part_no || 'Return Part').trim(),
          (it.reference_invoice_no || ref_invoice_no || '').trim(),
          q,
          r,
          val
        ]);
      }
    }

    const now = new Date().toISOString();

    await dbAsync.run(`
      UPDATE returns
      SET 
        return_no = ?,
        ref_invoice_no = ?,
        ref_invoice_date = ?,
        return_date = ?,
        party_code = ?,
        party_name = ?,
        remark_id = ?,
        remark_name = ?,
        is_dms_received = ?,
        str_no = ?,
        status = ?,
        total_qty = ?,
        total_value = ?,
        internal_remarks = ?,
        attachment_url = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      return_no || existing.return_no,
      ref_invoice_no !== undefined ? ref_invoice_no : existing.ref_invoice_no,
      ref_invoice_date !== undefined ? ref_invoice_date : existing.ref_invoice_date,
      return_date || existing.return_date,
      party_code || existing.party_code,
      party_name || existing.party_name,
      remark_id !== undefined ? remark_id : existing.remark_id,
      remark_name !== undefined ? remark_name : existing.remark_name,
      isDms,
      str_no !== undefined ? str_no : existing.str_no,
      finalStatus,
      totalQty,
      totalValue,
      internal_remarks !== undefined ? internal_remarks : existing.internal_remarks,
      attachment_url !== undefined ? attachment_url : existing.attachment_url,
      now,
      id
    ]);

    if (req.io) {
      req.io.emit('returnUpdated', { id, return_no: return_no || existing.return_no });
    }

    return res.json({ message: 'Return record updated successfully!' });
  } catch (err) {
    console.error('updateReturn error:', err);
    return res.status(500).json({ message: err.message || 'Error updating return record.' });
  }
}

// Mark DMS Received quick action
async function markDmsReceived(req, res) {
  try {
    const { id } = req.params;
    const { str_no } = req.body;

    if (!str_no || !str_no.trim()) {
      return res.status(400).json({ message: 'STR No. is required to confirm DMS Receipt.' });
    }

    const existing = await dbAsync.get('SELECT * FROM returns WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: 'Return record not found.' });
    }

    const now = new Date().toISOString();
    await dbAsync.run(`
      UPDATE returns
      SET is_dms_received = 1, str_no = ?, status = 'DMS Received', updated_at = ?
      WHERE id = ?
    `, [str_no.trim(), now, id]);

    if (req.io) {
      req.io.emit('returnUpdated', { id, action: 'DMS_RECEIVED' });
    }

    return res.json({ message: 'DMS Status and STR No. updated successfully!' });
  } catch (err) {
    console.error('markDmsReceived error:', err);
    return res.status(500).json({ message: 'Error updating DMS status.' });
  }
}

// Delete Return
async function deleteReturn(req, res) {
  try {
    const { id } = req.params;
    await dbAsync.run('DELETE FROM returns WHERE id = ?', [id]);
    if (req.io) {
      req.io.emit('returnDeleted', { id });
    }
    return res.json({ message: 'Return record deleted successfully!' });
  } catch (err) {
    console.error('deleteReturn error:', err);
    return res.status(500).json({ message: 'Error deleting return record.' });
  }
}

// Get Return Analytics & Reports
async function getReturnReports(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const whCondition = 'WHERE warehouse_id = ?';
    const whParams = [whId];

    // KPIs
    const totalCountRow = await dbAsync.get(`SELECT COUNT(*) as count, COALESCE(SUM(total_value), 0) as total_value, COALESCE(SUM(total_qty), 0) as total_qty FROM returns ${whCondition}`, whParams);
    const dmsPendingRow = await dbAsync.get(`SELECT COUNT(*) as count FROM returns ${whCondition} AND (is_dms_received = 0 OR is_dms_received IS NULL)`, whParams);
    const dmsReceivedRow = await dbAsync.get(`SELECT COUNT(*) as count FROM returns ${whCondition} AND is_dms_received = 1`, whParams);

    // Reason Breakdown
    const reasonBreakdown = await dbAsync.all(`
      SELECT 
        COALESCE(remark_name, 'Unspecified') as reason,
        COUNT(*) as count,
        COALESCE(SUM(total_value), 0) as total_value,
        COALESCE(SUM(total_qty), 0) as total_qty
      FROM returns
      ${whCondition}
      GROUP BY remark_name
      ORDER BY count DESC
    `, whParams);

    // Top Parties by Return Value
    const topParties = await dbAsync.all(`
      SELECT 
        party_name,
        party_code,
        COUNT(*) as return_count,
        COALESCE(SUM(total_value), 0) as total_value,
        COALESCE(SUM(total_qty), 0) as total_qty
      FROM returns
      ${whCondition}
      GROUP BY party_code, party_name
      ORDER BY total_value DESC
      LIMIT 10
    `, whParams);

    // Top Parts Returned
    const topParts = await dbAsync.all(`
      SELECT 
        ri.part_no,
        ri.part_name,
        COUNT(*) as frequency,
        COALESCE(SUM(ri.qty), 0) as total_qty,
        COALESCE(SUM(ri.value), 0) as total_value
      FROM return_items ri
      JOIN returns r ON ri.return_id = r.id
      ${whCondition}
      GROUP BY ri.part_no, ri.part_name
      ORDER BY total_qty DESC
      LIMIT 10
    `, whParams);

    // Daily / Recent Trend
    const trendData = await dbAsync.all(`
      SELECT 
        return_date as date,
        COUNT(*) as returns_count,
        COALESCE(SUM(total_value), 0) as total_value,
        COALESCE(SUM(total_qty), 0) as total_qty
      FROM returns
      ${whCondition}
      GROUP BY return_date
      ORDER BY return_date DESC
      LIMIT 15
    `, whParams);

    return res.json({
      summary: {
        totalReturns: totalCountRow?.count || 0,
        totalValue: totalCountRow?.total_value || 0,
        totalQty: totalCountRow?.total_qty || 0,
        dmsPending: dmsPendingRow?.count || 0,
        dmsReceived: dmsReceivedRow?.count || 0
      },
      reasonBreakdown: reasonBreakdown || [],
      topParties: topParties || [],
      topParts: topParts || [],
      trendData: (trendData || []).reverse()
    });
  } catch (err) {
    console.error('getReturnReports error:', err);
    return res.status(500).json({ message: 'Error generating return reports.' });
  }
}

// Invoices / Parts lookup helper for Return Entry
async function searchInvoices(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const { party_code, search = '' } = req.query;

    let sql = `
      SELECT DISTINCT 
        b.bill_no, 
        b.billing_date, 
        pt.party_code, 
        pt.party_name, 
        b.invoice_amount 
      FROM billings b
      JOIN pick_tickets pt ON b.pick_ticket_id = pt.id
      WHERE b.warehouse_id = ?
    `;
    const params = [whId];

    if (party_code) {
      sql += ' AND pt.party_code = ?';
      params.push(party_code);
    }
    if (search && search.trim()) {
      sql += ' AND (b.bill_no LIKE ? OR pt.party_name LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ' ORDER BY b.id DESC LIMIT 20';
    const rows = await dbAsync.all(sql, params);
    return res.json(rows || []);
  } catch (err) {
    console.error('searchInvoices error:', err);
    return res.status(500).json({ message: 'Error searching invoices.' });
  }
}

module.exports = {
  suggestNextNo,
  getReturns,
  getReturnById,
  createReturn,
  updateReturn,
  markDmsReceived,
  deleteReturn,
  getReturnReports,
  searchInvoices
};
