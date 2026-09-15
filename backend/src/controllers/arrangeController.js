const { dbAsync } = require('../config/db');

async function ensureArrangesTable() {
  try {
    await dbAsync.exec(`
      CREATE TABLE IF NOT EXISTS arranges (
        id INT AUTO_INCREMENT PRIMARY KEY,
        arrange_no VARCHAR(100) UNIQUE NOT NULL,
        arrange_date VARCHAR(50) NOT NULL,
        sti_no VARCHAR(100) NOT NULL,
        str_no VARCHAR(100) NOT NULL,
        arrange_by_team_id INT NULL,
        arrange_by_team_name VARCHAR(255) NULL,
        arrange_for VARCHAR(50) NOT NULL DEFAULT 'Party',
        destination_code VARCHAR(100) NULL,
        destination_name VARCHAR(255) NULL,
        status VARCHAR(50) DEFAULT 'Created',
        pick_ticket_id INT NULL,
        pick_ticket_no VARCHAR(100) NULL,
        billing_id INT NULL,
        billing_no VARCHAR(100) NULL,
        total_qty INT DEFAULT 0,
        remarks TEXT,
        warehouse_id INT NOT NULL,
        created_by VARCHAR(100) DEFAULT 'System',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await dbAsync.exec(`
      CREATE TABLE IF NOT EXISTS arrange_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        arrange_id INT NOT NULL,
        part_no VARCHAR(100) NOT NULL,
        part_name VARCHAR(255) NOT NULL,
        required_qty INT NOT NULL DEFAULT 1,
        available_qty INT DEFAULT 0,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (arrange_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (e) {
    try {
      await dbAsync.exec(`
        CREATE TABLE IF NOT EXISTS arranges (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          arrange_no TEXT UNIQUE NOT NULL,
          arrange_date TEXT NOT NULL,
          sti_no TEXT NOT NULL,
          str_no TEXT NOT NULL,
          arrange_by_team_id INTEGER,
          arrange_by_team_name TEXT,
          arrange_for TEXT NOT NULL DEFAULT 'Party',
          destination_code TEXT,
          destination_name TEXT,
          status TEXT DEFAULT 'Created',
          pick_ticket_id INTEGER,
          pick_ticket_no TEXT,
          billing_id INTEGER,
          billing_no TEXT,
          total_qty INTEGER DEFAULT 0,
          remarks TEXT,
          warehouse_id INTEGER NOT NULL,
          created_by TEXT DEFAULT 'System',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME
        );
      `);
      await dbAsync.exec(`
        CREATE TABLE IF NOT EXISTS arrange_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          arrange_id INTEGER NOT NULL,
          part_no TEXT NOT NULL,
          part_name TEXT NOT NULL,
          required_qty INTEGER NOT NULL DEFAULT 1,
          available_qty INTEGER DEFAULT 0,
          remarks TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e2) {}
  }
}

// Suggest next Arrange Number (e.g. ARR-20260914-0001)
async function suggestNextNo(req, res) {
  try {
    await ensureArrangesTable();
    const whId = req.activeWarehouseId || 1;
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `ARR-${dateStr}-`;

    const lastArrange = await dbAsync.get(`
      SELECT arrange_no FROM arranges 
      WHERE arrange_no LIKE ? AND warehouse_id = ?
      ORDER BY id DESC LIMIT 1
    `, [`${prefix}%`, whId]);

    let seq = 1;
    if (lastArrange && lastArrange.arrange_no) {
      const parts = lastArrange.arrange_no.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    const suggestedNo = `${prefix}${String(seq).padStart(4, '0')}`;
    return res.json({ suggestedNo });
  } catch (err) {
    console.error('suggestNextNo error:', err);
    return res.status(500).json({ message: 'Error generating arrange number.' });
  }
}

// Get all Arranges with filtering and pagination
async function getArranges(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const {
      search = '',
      arrange_for = '',
      team_id = '',
      status = '',
      from_date = '',
      to_date = '',
      page = 1,
      limit = 50
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (parsedPage - 1) * parsedLimit;

    let whereClause = 'WHERE a.warehouse_id = ?';
    const params = [whId];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      whereClause += ' AND (a.arrange_no LIKE ? OR a.sti_no LIKE ? OR a.str_no LIKE ? OR a.destination_name LIKE ? OR a.destination_code LIKE ? OR a.pick_ticket_no LIKE ? OR a.billing_no LIKE ?)';
      params.push(s, s, s, s, s, s, s);
    }

    if (arrange_for && arrange_for.trim()) {
      whereClause += ' AND a.arrange_for = ?';
      params.push(arrange_for.trim());
    }

    if (team_id && team_id.trim()) {
      whereClause += ' AND a.arrange_by_team_id = ?';
      params.push(parseInt(team_id, 10));
    }

    if (status && status.trim()) {
      whereClause += ' AND a.status = ?';
      params.push(status.trim());
    }

    if (from_date && from_date.trim()) {
      whereClause += ' AND a.arrange_date >= ?';
      params.push(from_date.trim());
    }

    if (to_date && to_date.trim()) {
      whereClause += ' AND a.arrange_date <= ?';
      params.push(to_date.trim());
    }

    const countSql = `SELECT COUNT(*) as total FROM arranges a ${whereClause}`;
    const countRow = await dbAsync.get(countSql, params);
    const totalRecords = countRow?.total || 0;

    const dataSql = `
      SELECT 
        a.*,
        (SELECT COUNT(*) FROM arrange_items WHERE arrange_id = a.id) as item_count
      FROM arranges a
      ${whereClause}
      ORDER BY a.id DESC
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
    console.error('getArranges error:', err);
    return res.status(500).json({ message: 'Error fetching arranges.' });
  }
}

// Get single Arrange by ID with item rows and linked Pick Ticket/Bill
async function getArrangeById(req, res) {
  try {
    const { id } = req.params;
    const arrange = await dbAsync.get('SELECT * FROM arranges WHERE id = ?', [id]);
    if (!arrange) {
      return res.status(404).json({ message: 'Arrange record not found.' });
    }

    const items = await dbAsync.all('SELECT * FROM arrange_items WHERE arrange_id = ? ORDER BY id ASC', [id]);

    // Check linked Pick Ticket details if present
    let pickTicket = null;
    if (arrange.pick_ticket_id || arrange.pick_ticket_no) {
      pickTicket = await dbAsync.get(
        'SELECT * FROM pick_tickets WHERE id = ? OR ticket_no = ?',
        [arrange.pick_ticket_id || 0, arrange.pick_ticket_no || '']
      );
    }

    // Check linked Billing details
    let billing = null;
    if (arrange.billing_id || arrange.billing_no) {
      billing = await dbAsync.get(
        'SELECT * FROM billings WHERE id = ? OR bill_no = ?',
        [arrange.billing_id || 0, arrange.billing_no || '']
      );
    }

    return res.json({
      ...arrange,
      items: items || [],
      pickTicket,
      billing
    });
  } catch (err) {
    console.error('getArrangeById error:', err);
    return res.status(500).json({ message: 'Error fetching arrange details.' });
  }
}

// Create new Arrange
async function createArrange(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const user = req.user?.full_name || req.user?.username || 'System';

    let {
      arrange_no,
      arrange_date,
      sti_no,
      str_no,
      arrange_by_team_id,
      arrange_by_team_name,
      arrange_for = 'Party',
      destination_code,
      destination_name,
      status = 'Created',
      remarks,
      items = []
    } = req.body;

    if (!sti_no || !sti_no.trim()) {
      return res.status(400).json({ message: 'STI No. is mandatory.' });
    }

    if (!str_no || !str_no.trim()) {
      return res.status(400).json({ message: 'DMS Receipt / STR No. is mandatory.' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one part item is required for arrangement.' });
    }

    // Auto-generate arrange_no if missing
    if (!arrange_no || !arrange_no.trim()) {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = `ARR-${dateStr}-`;
      const last = await dbAsync.get(`SELECT arrange_no FROM arranges WHERE arrange_no LIKE ? ORDER BY id DESC LIMIT 1`, [`${prefix}%`]);
      let seq = 1;
      if (last && last.arrange_no) {
        const p = last.arrange_no.split('-');
        const s = parseInt(p[p.length - 1], 10);
        if (!isNaN(s)) seq = s + 1;
      }
      arrange_no = `${prefix}${String(seq).padStart(4, '0')}`;
    }

    // Calculate total quantity
    let totalQty = 0;
    const cleanItems = items.map(it => {
      const q = Math.max(1, parseInt(it.required_qty || it.qty, 10) || 1);
      const avail = Math.max(0, parseInt(it.available_qty, 10) || 0);
      totalQty += q;
      return {
        part_no: (it.part_no || '').trim(),
        part_name: (it.part_name || '').trim(),
        required_qty: q,
        available_qty: avail,
        remarks: (it.remarks || '').trim()
      };
    });

    const arrDate = arrange_date || new Date().toISOString().slice(0, 10);

    const result = await dbAsync.run(`
      INSERT INTO arranges (
        arrange_no, arrange_date, sti_no, str_no,
        arrange_by_team_id, arrange_by_team_name,
        arrange_for, destination_code, destination_name,
        status, total_qty, remarks, warehouse_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      arrange_no.trim(),
      arrDate,
      sti_no.trim(),
      str_no.trim(),
      arrange_by_team_id || null,
      arrange_by_team_name || null,
      arrange_for,
      destination_code ? destination_code.trim() : null,
      destination_name ? destination_name.trim() : null,
      status,
      totalQty,
      remarks || null,
      whId,
      user
    ]);

    const arrangeId = result.id;

    // Insert items
    for (const it of cleanItems) {
      await dbAsync.run(`
        INSERT INTO arrange_items (arrange_id, part_no, part_name, required_qty, available_qty, remarks)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        arrangeId,
        it.part_no,
        it.part_name,
        it.required_qty,
        it.available_qty,
        it.remarks
      ]);
    }

    if (req.io) {
      req.io.emit('arrangeCreated', { id: arrangeId, arrange_no, sti_no });
    }

    return res.json({
      message: 'Arrange entry created successfully!',
      id: arrangeId,
      arrange_no
    });
  } catch (err) {
    console.error('createArrange error:', err);
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ message: 'An arrange record with this Arrange No. already exists.' });
    }
    return res.status(500).json({ message: err.message || 'Error creating arrange record.' });
  }
}

// Update Arrange
async function updateArrange(req, res) {
  try {
    const { id } = req.params;
    const existing = await dbAsync.get('SELECT * FROM arranges WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: 'Arrange record not found.' });
    }

    let {
      arrange_no,
      arrange_date,
      sti_no,
      str_no,
      arrange_by_team_id,
      arrange_by_team_name,
      arrange_for,
      destination_code,
      destination_name,
      status,
      remarks,
      items
    } = req.body;

    let totalQty = existing.total_qty;

    if (items && Array.isArray(items)) {
      totalQty = 0;
      await dbAsync.run('DELETE FROM arrange_items WHERE arrange_id = ?', [id]);
      for (const it of items) {
        const q = Math.max(1, parseInt(it.required_qty || it.qty, 10) || 1);
        const avail = Math.max(0, parseInt(it.available_qty, 10) || 0);
        totalQty += q;
        await dbAsync.run(`
          INSERT INTO arrange_items (arrange_id, part_no, part_name, required_qty, available_qty, remarks)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          id,
          (it.part_no || '').trim(),
          (it.part_name || '').trim(),
          q,
          avail,
          (it.remarks || '').trim()
        ]);
      }
    }

    const now = new Date().toISOString();

    await dbAsync.run(`
      UPDATE arranges
      SET 
        arrange_no = ?,
        arrange_date = ?,
        sti_no = ?,
        str_no = ?,
        arrange_by_team_id = ?,
        arrange_by_team_name = ?,
        arrange_for = ?,
        destination_code = ?,
        destination_name = ?,
        status = ?,
        total_qty = ?,
        remarks = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      arrange_no || existing.arrange_no,
      arrange_date || existing.arrange_date,
      sti_no || existing.sti_no,
      str_no || existing.str_no,
      arrange_by_team_id !== undefined ? arrange_by_team_id : existing.arrange_by_team_id,
      arrange_by_team_name !== undefined ? arrange_by_team_name : existing.arrange_by_team_name,
      arrange_for || existing.arrange_for,
      destination_code !== undefined ? destination_code : existing.destination_code,
      destination_name !== undefined ? destination_name : existing.destination_name,
      status || existing.status,
      totalQty,
      remarks !== undefined ? remarks : existing.remarks,
      now,
      id
    ]);

    if (req.io) {
      req.io.emit('arrangeUpdated', { id, arrange_no: arrange_no || existing.arrange_no });
    }

    return res.json({ message: 'Arrange record updated successfully!' });
  } catch (err) {
    console.error('updateArrange error:', err);
    return res.status(500).json({ message: err.message || 'Error updating arrange record.' });
  }
}

// Convert Arrange directly to Pick Ticket
async function convertToPickTicket(req, res) {
  try {
    const { id } = req.params;
    const whId = req.activeWarehouseId || 1;
    const user = req.user?.full_name || req.user?.username || 'System';

    const arrange = await dbAsync.get('SELECT * FROM arranges WHERE id = ?', [id]);
    if (!arrange) {
      return res.status(404).json({ message: 'Arrange record not found.' });
    }

    if (arrange.pick_ticket_id && arrange.pick_ticket_no) {
      return res.status(400).json({
        message: `Pick Ticket already generated: ${arrange.pick_ticket_no}`,
        pick_ticket_no: arrange.pick_ticket_no,
        pick_ticket_id: arrange.pick_ticket_id
      });
    }

    // Get party details if destination is Party or Retail Outlet
    let partyCode = arrange.destination_code || 'STOCK';
    let partyName = arrange.destination_name || 'Warehouse Stock Replenishment';
    let routeName = 'Direct Route';
    let salesmanName = 'General Sales';

    if (partyCode && partyCode !== 'STOCK') {
      const p = await dbAsync.get('SELECT * FROM parties WHERE party_code = ? LIMIT 1', [partyCode]);
      if (p) {
        partyName = p.party_name || partyName;
        routeName = p.route_name || routeName;
        salesmanName = p.salesman || salesmanName;
      }
    }

    // Generate Pick Ticket Number
    const wh = await dbAsync.get('SELECT prefix_logic FROM warehouses WHERE id = ?', [whId]);
    const prefix = wh?.prefix_logic || 'PIK26-';

    const lastPt = await dbAsync.get(`
      SELECT ticket_no FROM pick_tickets 
      WHERE ticket_no LIKE ? AND warehouse_id = ?
      ORDER BY id DESC LIMIT 1
    `, [`${prefix}%`, whId]);

    let seq = 1;
    if (lastPt && lastPt.ticket_no) {
      const numPart = lastPt.ticket_no.replace(prefix, '');
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }
    const ticketNo = `${prefix}${String(seq).padStart(6, '0')}`;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    // Insert Pick Ticket
    const ptResult = await dbAsync.run(`
      INSERT INTO pick_tickets (
        date, time, ticket_no, customer_order_no, qty_in_pick_ticket,
        picker_id, party_code, party_name, route, salesman,
        priority, remarks, status, warehouse_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Assigned', ?, ?)
    `, [
      dateStr,
      timeStr,
      ticketNo,
      arrange.sti_no,
      arrange.total_qty || 1,
      arrange.arrange_by_team_name || 'Unassigned',
      partyCode,
      partyName,
      routeName,
      salesmanName,
      'Normal',
      `Generated from Arrange ${arrange.arrange_no} (STR: ${arrange.str_no})`,
      whId,
      user
    ]);

    const ptId = ptResult.id;

    // Update arrange status and link
    const nowIso = new Date().toISOString();
    await dbAsync.run(`
      UPDATE arranges
      SET pick_ticket_id = ?, pick_ticket_no = ?, status = 'Pick Ticket Created', updated_at = ?
      WHERE id = ?
    `, [ptId, ticketNo, nowIso, id]);

    if (req.io) {
      req.io.emit('pickTicketCreated', { ticket_no: ticketNo, party_name: partyName });
      req.io.emit('arrangeUpdated', { id, status: 'Pick Ticket Created', pick_ticket_no: ticketNo });
    }

    return res.json({
      message: `Pick Ticket ${ticketNo} successfully created and linked to Arrange ${arrange.arrange_no}!`,
      pick_ticket_id: ptId,
      pick_ticket_no: ticketNo
    });
  } catch (err) {
    console.error('convertToPickTicket error:', err);
    return res.status(500).json({ message: err.message || 'Error generating pick ticket from arrange.' });
  }
}

// Delete Arrange
async function deleteArrange(req, res) {
  try {
    const { id } = req.params;
    await dbAsync.run('DELETE FROM arranges WHERE id = ?', [id]);
    if (req.io) {
      req.io.emit('arrangeDeleted', { id });
    }
    return res.json({ message: 'Arrange record deleted successfully!' });
  } catch (err) {
    console.error('deleteArrange error:', err);
    return res.status(500).json({ message: 'Error deleting arrange record.' });
  }
}

// Arrange Reports & Fulfillment Velocity
async function getArrangeReports(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const whCondition = 'WHERE warehouse_id = ?';
    const whParams = [whId];

    // Summary KPIs
    const totalArranges = await dbAsync.get(`SELECT COUNT(*) as count, COALESCE(SUM(total_qty), 0) as total_qty FROM arranges ${whCondition}`, whParams);
    const pendingPickTicket = await dbAsync.get(`SELECT COUNT(*) as count FROM arranges ${whCondition} AND pick_ticket_id IS NULL`, whParams);
    const pickTicketGenerated = await dbAsync.get(`SELECT COUNT(*) as count FROM arranges ${whCondition} AND pick_ticket_id IS NOT NULL`, whParams);
    const completedArranges = await dbAsync.get(`SELECT COUNT(*) as count FROM arranges ${whCondition} AND status IN ('Completed', 'Billed')`, whParams);

    // Arrange For Breakdown
    const arrangeForBreakdown = await dbAsync.all(`
      SELECT 
        arrange_for,
        COUNT(*) as count,
        COALESCE(SUM(total_qty), 0) as total_qty
      FROM arranges
      ${whCondition}
      GROUP BY arrange_for
      ORDER BY count DESC
    `, whParams);

    // Team Performance
    const teamBreakdown = await dbAsync.all(`
      SELECT 
        COALESCE(arrange_by_team_name, 'Unassigned Team') as team_name,
        COUNT(*) as arrange_count,
        COALESCE(SUM(total_qty), 0) as total_qty,
        SUM(CASE WHEN pick_ticket_id IS NOT NULL THEN 1 ELSE 0 END) as converted_to_pt
      FROM arranges
      ${whCondition}
      GROUP BY arrange_by_team_name
      ORDER BY arrange_count DESC
    `, whParams);

    // Daily Trend
    const trendData = await dbAsync.all(`
      SELECT 
        arrange_date as date,
        COUNT(*) as arrange_count,
        COALESCE(SUM(total_qty), 0) as total_qty
      FROM arranges
      ${whCondition}
      GROUP BY arrange_date
      ORDER BY arrange_date DESC
      LIMIT 15
    `, whParams);

    return res.json({
      summary: {
        totalArranges: totalArranges?.count || 0,
        totalQty: totalArranges?.total_qty || 0,
        pendingPickTicket: pendingPickTicket?.count || 0,
        pickTicketGenerated: pickTicketGenerated?.count || 0,
        completedArranges: completedArranges?.count || 0
      },
      arrangeForBreakdown: arrangeForBreakdown || [],
      teamBreakdown: teamBreakdown || [],
      trendData: (trendData || []).reverse()
    });
  } catch (err) {
    console.error('getArrangeReports error:', err);
    return res.status(500).json({ message: 'Error generating arrange reports.' });
  }
}

module.exports = {
  suggestNextNo,
  getArranges,
  getArrangeById,
  createArrange,
  updateArrange,
  convertToPickTicket,
  deleteArrange,
  getArrangeReports
};
