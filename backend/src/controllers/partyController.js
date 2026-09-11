const { dbAsync } = require('../config/db');

async function getParties(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const parties = await dbAsync.all(`
      SELECT p.*, COALESCE(rm.route_name, p.route_name, p.address) as route_name
      FROM parties p
      LEFT JOIN route_masters rm ON p.route_id = rm.id
      WHERE (p.warehouse_id = ? OR p.warehouse_id IS NULL OR ? = 1)
      ORDER BY p.party_name ASC
    `, [whId, whId]);
    return res.json(parties);
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching parties.' });
  }
}

async function getPartyByCode(req, res) {
  try {
    const { code } = req.params;
    const whId = req.activeWarehouseId || 1;
    const party = await dbAsync.get(
      'SELECT * FROM parties WHERE (party_code = ? OR party_code LIKE ?) AND (warehouse_id = ? OR warehouse_id IS NULL OR ? = 1)',
      [code, `%${code}%`, whId, whId]
    );
    if (!party) {
      return res.status(404).json({ message: 'Party Code not found in Master for active warehouse.' });
    }
    return res.json({
      partyCode: party.party_code,
      partyName: party.party_name,
      route: party.route_name || party.address || 'Direct Route',
      salesman: party.salesman || 'General Sales',
      phone: party.phone,
      gstin: party.gstin,
      creditLimit: party.credit_limit
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching party by code.' });
  }
}

async function createParty(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const { party_code, party_name, address, city, phone, gstin, credit_limit, salesman, route_name, route_id, lat, lng } = req.body;

    if (!party_name) {
      return res.status(400).json({ message: 'Party name is required.' });
    }

    const finalCode = party_code ? party_code.trim().toUpperCase() : `PTY-${Math.floor(1000 + Math.random() * 9000)}`;

    // Check duplicate code ONLY in the active warehouse context
    const existing = await dbAsync.get('SELECT id FROM parties WHERE party_code = ? AND warehouse_id = ?', [finalCode, whId]);
    if (existing) {
      return res.status(400).json({ message: `Party code "${finalCode}" already exists in this warehouse.` });
    }

    const result = await dbAsync.run(`
      INSERT INTO parties (party_code, party_name, address, city, phone, gstin, salesman, route_name, credit_limit, warehouse_id, route_id, lat, lng, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      finalCode,
      party_name,
      address || '',
      city || 'Delhi',
      phone || '',
      gstin || '',
      salesman || 'General Sales',
      route_name || 'Direct Route',
      parseFloat(credit_limit || 0),
      whId,
      route_id || null,
      parseFloat(lat || 28.6139),
      parseFloat(lng || 77.2090)
    ]);

    return res.json({
      message: 'Party registered successfully!',
      id: result.id,
      party_code: finalCode
    });
  } catch (err) {
    console.error('Create party error:', err);
    return res.status(500).json({ message: 'Error creating party.' });
  }
}

async function updateParty(req, res) {
  try {
    const { id } = req.params;
    const whId = req.activeWarehouseId;
    const { party_name, phone, gstin, credit_limit, salesman, route_name, is_active } = req.body;

    const party = await dbAsync.get('SELECT * FROM parties WHERE id = ? AND warehouse_id = ?', [id, whId]);
    if (!party) return res.status(404).json({ message: 'Party not found in active warehouse.' });

    await dbAsync.run(`
      UPDATE parties
      SET party_name = ?, phone = ?, gstin = ?, credit_limit = ?, salesman = ?, route_name = ?, is_active = ?
      WHERE id = ? AND warehouse_id = ?
    `, [
      party_name || party.party_name,
      phone !== undefined ? phone : party.phone,
      gstin !== undefined ? gstin : party.gstin,
      credit_limit !== undefined ? parseFloat(credit_limit) : party.credit_limit,
      salesman !== undefined ? salesman : party.salesman,
      route_name !== undefined ? route_name : party.route_name,
      is_active !== undefined ? (is_active ? 1 : 0) : party.is_active,
      id,
      whId
    ]);

    return res.json({ message: 'Party updated successfully.' });
  } catch (err) {
    console.error('Update party error:', err);
    return res.status(500).json({ message: 'Error updating party.' });
  }
}

async function deleteParty(req, res) {
  try {
    const { id } = req.params;
    const whId = req.activeWarehouseId;
    const party = await dbAsync.get('SELECT * FROM parties WHERE id = ? AND warehouse_id = ?', [id, whId]);
    if (!party) return res.status(404).json({ message: 'Party not found in active warehouse.' });

    // Check if party has pick tickets in this warehouse
    const pickTickets = await dbAsync.get('SELECT COUNT(*) as cnt FROM pick_tickets WHERE party_code = ? AND warehouse_id = ?', [party.party_code, whId]);
    if (pickTickets && pickTickets.cnt > 0) {
      return res.status(400).json({ message: `Cannot delete party "${party.party_name}" — it has ${pickTickets.cnt} pick ticket(s) linked in this warehouse.` });
    }

    await dbAsync.run('DELETE FROM parties WHERE id = ? AND warehouse_id = ?', [id, whId]);
    return res.json({ message: `Party "${party.party_name}" deleted successfully from this warehouse.` });
  } catch (err) {
    console.error('Delete party error:', err);
    return res.status(500).json({ message: 'Error deleting party.' });
  }
}

module.exports = {
  getParties,
  getPartyByCode,
  createParty,
  updateParty,
  deleteParty
};
