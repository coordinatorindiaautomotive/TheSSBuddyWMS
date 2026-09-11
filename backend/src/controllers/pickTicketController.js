const { dbAsync } = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

async function getPickTickets(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const tickets = await dbAsync.all(`
      SELECT pt.*, COALESCE(pkh.name, pt.picker_id) as picker_name, pkh.employee_code as picker_employee_code
      FROM pick_tickets pt
      LEFT JOIN picker_checker_helpers pkh ON pt.picker_id = pkh.id OR pt.picker_id = pkh.employee_code OR LOWER(pt.picker_id) = LOWER(pkh.name)
      WHERE pt.warehouse_id = ?
      ORDER BY pt.created_at DESC
    `, [whId]);

    return res.json(tickets);
  } catch (err) {
    console.error('Error fetching pick tickets:', err);
    return res.status(500).json({ message: 'Error fetching pick tickets.' });
  }
}

async function getPickTicketById(req, res) {
  try {
    const { id } = req.params;
    const ticket = await dbAsync.get(`
      SELECT pt.*, pkh.name as picker_name
      FROM pick_tickets pt
      LEFT JOIN picker_checker_helpers pkh ON pt.picker_id = pkh.id OR pt.picker_id = pkh.employee_code
      WHERE pt.id = ? OR pt.ticket_no = ?
    `, [id, id]);

    if (!ticket) {
      return res.status(404).json({ message: 'Pick Ticket not found.' });
    }

    return res.json({
      pickTicketId: ticket.id,
      pickTicketNo: ticket.ticket_no,
      customerOrderNo: ticket.customer_order_no,
      date: ticket.date,
      time: ticket.time,
      qtyInPickTicket: ticket.qty_in_pick_ticket,
      pickerId: ticket.picker_id,
      pickerName: ticket.picker_name || 'Assigned Picker',
      partyCode: ticket.party_code,
      partyName: ticket.party_name,
      route: ticket.route,
      salesman: ticket.salesman,
      priority: ticket.priority,
      remarks: ticket.remarks,
      status: ticket.status,
      warehouseId: ticket.warehouse_id
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching pick ticket details.' });
  }
}

async function suggestNextNo(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const wh = await dbAsync.get('SELECT prefix_logic FROM warehouses WHERE id = ?', [whId]);
    let prefix = req.query.prefix || (wh && wh.prefix_logic ? wh.prefix_logic : 'PIK/');

    if (!prefix.endsWith('/')) {
      if (prefix.includes('-')) {
        prefix = 'PIK/';
      } else {
        prefix = `${prefix}/`;
      }
    }

    const yearSuffix = new Date().getFullYear().toString().substring(2);

    const lastTicket = await dbAsync.get(`
      SELECT ticket_no FROM pick_tickets
      WHERE warehouse_id = ? AND (ticket_no LIKE ? OR ticket_no LIKE 'PIK%')
      ORDER BY id DESC LIMIT 1
    `, [whId, `${prefix}%`]);

    let nextNumber = 1;
    if (lastTicket && lastTicket.ticket_no) {
      const match = lastTicket.ticket_no.match(/\d+$/);
      if (match) {
        const raw = match[0];
        if (raw.length === 8 && raw.startsWith(yearSuffix)) {
          nextNumber = parseInt(raw.substring(2), 10) + 1;
        } else if (raw.length >= 6) {
          nextNumber = parseInt(raw.slice(-6), 10) + 1;
        } else {
          nextNumber = parseInt(raw, 10) + 1;
        }
      }
    }

    const suggestedNo = `${prefix}${yearSuffix}${String(nextNumber).padStart(6, '0')}`;
    return res.json({ suggestedNo });
  } catch (err) {
    const yearSuffix = new Date().getFullYear().toString().substring(2);
    return res.status(500).json({ suggestedNo: `PIK/${yearSuffix}000001` });
  }
}

async function validateNumber(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const { ticketNo, customerOrderNo } = req.query;

    if (ticketNo) {
      const exists = await dbAsync.get('SELECT id FROM pick_tickets WHERE ticket_no = ? AND warehouse_id = ?', [ticketNo, whId]);
      return res.json({ isUnique: !exists });
    }

    if (customerOrderNo) {
      const exists = await dbAsync.get('SELECT id FROM pick_tickets WHERE customer_order_no = ? AND warehouse_id = ?', [customerOrderNo, whId]);
      return res.json({ isUnique: !exists });
    }

    return res.json({ isUnique: true });
  } catch (err) {
    return res.status(500).json({ isUnique: true });
  }
}

async function createPickTicket(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const {
      date,
      time,
      ticket_no,
      customer_order_no,
      qty_in_pick_ticket,
      picker_id,
      party_code,
      party_name,
      route,
      salesman,
      priority,
      remarks
    } = req.body;

    const ticketNo = ticket_no || `PIK26-${Math.floor(100000 + Math.random() * 900000)}`;

    if (!party_code && !party_name) {
      return res.status(400).json({ message: 'Party Code or Party Name is required.' });
    }

    let finalPartyCode = (party_code || 'PRT-GEN').trim().toUpperCase();
    let finalPartyName = party_name;
    let finalRoute = route;
    let finalSalesman = salesman;

    // Auto lookup party info if party_code is provided but party_name is missing
    if (finalPartyCode && !finalPartyName) {
      const pMatch = await dbAsync.get('SELECT party_name, route_name, salesman FROM parties WHERE UPPER(party_code) = ? AND warehouse_id = ?', [finalPartyCode, whId]);
      if (pMatch) {
        finalPartyName = pMatch.party_name;
        finalRoute = finalRoute || pMatch.route_name || 'Direct Route';
        finalSalesman = finalSalesman || pMatch.salesman || 'General Salesman';
      } else {
        finalPartyName = `Party (${finalPartyCode})`;
      }
    }

    // Check duplicate ticket_no
    const existing = await dbAsync.get('SELECT id FROM pick_tickets WHERE ticket_no = ? AND warehouse_id = ?', [ticketNo, whId]);
    if (existing) {
      return res.status(400).json({ message: `Pick Ticket Number '${ticketNo}' already exists in this warehouse.` });
    }

    const todayDate = date || new Date().toISOString().split('T')[0];
    const nowTime = time || new Date().toTimeString().split(' ')[0].substring(0, 5);

    const result = await dbAsync.run(`
      INSERT INTO pick_tickets (
        date, time, ticket_no, customer_order_no, qty_in_pick_ticket, picker_id,
        party_code, party_name, route, salesman, priority, remarks, status, warehouse_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Assigned', ?, ?)
    `, [
      todayDate,
      nowTime,
      ticketNo,
      customer_order_no || null,
      parseInt(qty_in_pick_ticket || 1, 10),
      picker_id || null,
      finalPartyCode,
      finalPartyName,
      finalRoute || 'Direct Route',
      finalSalesman || 'General Salesman',
      priority || 'Normal',
      remarks || '',
      whId,
      req.user ? req.user.username : 'System'
    ]);

    await logAudit(req, {
      action_type: 'CREATE',
      module: 'Pick Tickets',
      target_id: ticketNo,
      details: `Created Pick Ticket ${ticketNo} for ${finalPartyName} (Qty: ${qty_in_pick_ticket || 1}, Route: ${finalRoute || 'Direct Route'})`,
      changed_fields: { priority: priority || 'Normal', status: 'Assigned' }
    });

    return res.json({
      message: `Pick Ticket ${ticketNo} created successfully!`,
      id: result.id,
      ticket_no: ticketNo
    });
  } catch (err) {
    console.error('Create pick ticket error:', err);
    return res.status(500).json({ message: err.message || 'Error creating pick ticket.' });
  }
}

async function updatePickTicket(req, res) {
  try {
    const { id } = req.params;
    const {
      date,
      time,
      ticket_no,
      customer_order_no,
      qty_in_pick_ticket,
      picker_id,
      party_code,
      party_name,
      route,
      salesman,
      priority,
      remarks,
      status
    } = req.body;

    const ticket = await dbAsync.get('SELECT * FROM pick_tickets WHERE id = ?', [id]);
    if (!ticket) {
      return res.status(404).json({ message: 'Pick Ticket not found.' });
    }

    const finalStatus = status || ticket.status;

    await dbAsync.run(`
      UPDATE pick_tickets
      SET date = ?, time = ?, ticket_no = ?, customer_order_no = ?, qty_in_pick_ticket = ?,
          picker_id = ?, party_code = ?, party_name = ?, route = ?, salesman = ?,
          priority = ?, remarks = ?, status = ?
      WHERE id = ?
    `, [
      date || ticket.date,
      time || ticket.time,
      ticket_no || ticket.ticket_no,
      customer_order_no !== undefined ? customer_order_no : ticket.customer_order_no,
      qty_in_pick_ticket !== undefined ? parseInt(qty_in_pick_ticket, 10) : ticket.qty_in_pick_ticket,
      picker_id !== undefined ? (picker_id ? String(picker_id) : null) : ticket.picker_id,
      party_code || ticket.party_code,
      party_name || ticket.party_name,
      route || ticket.route,
      salesman || ticket.salesman,
      priority || ticket.priority,
      remarks !== undefined ? remarks : ticket.remarks,
      finalStatus,
      id
    ]);

    try {
      await logAudit(req, {
        action_type: 'UPDATE',
        module: 'Pick Tickets',
        target_id: ticket.ticket_no,
        details: `Updated Pick Ticket ${ticket.ticket_no}`,
        changed_fields: { status: finalStatus, priority: priority || ticket.priority }
      });
    } catch (auditErr) {
      console.warn('Pick ticket audit warning:', auditErr.message);
    }

    return res.json({ message: `Pick Ticket ${ticket.ticket_no} updated successfully!` });
  } catch (err) {
    console.error('Update pick ticket error:', err);
    return res.status(500).json({ message: err.message || 'Error updating pick ticket.' });
  }
}

async function deletePickTicket(req, res) {
  try {
    const { id } = req.params;
    const pt = await dbAsync.get('SELECT ticket_no, party_name FROM pick_tickets WHERE id = ?', [id]);
    
    await dbAsync.run('DELETE FROM billings WHERE pick_ticket_id = ?', [id]);
    await dbAsync.run('DELETE FROM pick_tickets WHERE id = ?', [id]);

    await logAudit(req, {
      action_type: 'DELETE',
      module: 'Pick Tickets',
      target_id: pt ? pt.ticket_no : `ID #${id}`,
      details: `Deleted Pick Ticket ${pt ? pt.ticket_no : id} (${pt ? pt.party_name : ''}) and reset linked billing records`,
      changed_fields: null
    });

    return res.json({ message: 'Pick Ticket deleted successfully.' });
  } catch (err) {
    console.error('Delete pick ticket error:', err);
    return res.status(500).json({ message: err.message || 'Error deleting pick ticket.' });
  }
}

module.exports = {
  getPickTickets,
  getPickTicketById,
  suggestNextNo,
  validateNumber,
  createPickTicket,
  updatePickTicket,
  deletePickTicket
};
