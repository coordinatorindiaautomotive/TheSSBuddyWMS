const { dbAsync } = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

async function getBillings(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const billings = await dbAsync.all(`
      SELECT b.*, pt.ticket_no, pt.customer_order_no, pt.party_code, pt.party_name, pt.route, pt.salesman, pt.qty_in_pick_ticket, pt.status as ticket_status,
             COALESCE(ch.name, b.checker_id) as checker_name, COALESCE(hl.name, b.helper_id) as helper_name
      FROM billings b
      JOIN pick_tickets pt ON b.pick_ticket_id = pt.id
      LEFT JOIN picker_checker_helpers ch ON b.checker_id = ch.id OR b.checker_id = ch.employee_code OR LOWER(b.checker_id) = LOWER(ch.name)
      LEFT JOIN picker_checker_helpers hl ON b.helper_id = hl.id OR b.helper_id = hl.employee_code OR LOWER(b.helper_id) = LOWER(hl.name)
      WHERE b.warehouse_id = ?
      ORDER BY b.created_at DESC
    `, [whId]);

    return res.json(billings);
  } catch (err) {
    console.error('Error fetching billings:', err);
    return res.status(500).json({ message: 'Error fetching billings.' });
  }
}

async function getPendingTickets(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const pendingTickets = await dbAsync.all(`
      SELECT pt.*, pkh.name as picker_name
      FROM pick_tickets pt
      LEFT JOIN picker_checker_helpers pkh ON pt.picker_id = pkh.id OR pt.picker_id = pkh.employee_code
      WHERE pt.warehouse_id = ? AND pt.status IN ('Created', 'Assigned', 'Picking In Progress', 'Picked')
      ORDER BY pt.created_at DESC
    `, [whId]);

    return res.json(pendingTickets);
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching pending pick tickets for billing.' });
  }
}

async function suggestNextBillNo(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const prefix = req.query.prefix || 'RS/';

    if (prefix === 'FREE') {
      return res.json({ suggestedNo: '' });
    }

    const lastBill = await dbAsync.get(`
      SELECT bill_no FROM billings
      WHERE warehouse_id = ? AND bill_no LIKE ?
      ORDER BY id DESC LIMIT 1
    `, [whId, `${prefix}%`]);

    let nextNum = 1;
    if (lastBill && lastBill.bill_no) {
      const match = lastBill.bill_no.match(/\d+$/);
      if (match) {
        nextNum = parseInt(match[0], 10) + 1;
      }
    }

    const yearSuffix = new Date().getFullYear().toString().substring(2);
    const suggestedNo = `${prefix}${yearSuffix}-${String(nextNum).padStart(6, '0')}`;
    return res.json({ suggestedNo });
  } catch (err) {
    return res.status(500).json({ suggestedNo: 'RS/26-000001' });
  }
}

async function createBilling(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const {
      pick_ticket_id,
      billing_date,
      billing_time,
      bill_no,
      billed_qty,
      checker_id,
      helper_id,
      start_time,
      end_time,
      invoice_amount,
      short_qty,
      excess_qty,
      damage_qty,
      billing_remarks
    } = req.body;

    if (!pick_ticket_id || !bill_no) {
      return res.status(400).json({ message: 'Pick Ticket and Invoice Bill No are required.' });
    }

    // Duplicate bill check
    const existing = await dbAsync.get('SELECT id FROM billings WHERE bill_no = ? AND warehouse_id = ?', [bill_no, whId]);
    if (existing) {
      return res.status(400).json({ message: `Bill Number '${bill_no}' already exists.` });
    }

    const ticket = await dbAsync.get('SELECT * FROM pick_tickets WHERE id = ?', [pick_ticket_id]);
    if (!ticket) {
      return res.status(404).json({ message: 'Selected Pick Ticket not found.' });
    }

    const bDate = billing_date || new Date().toISOString().split('T')[0];
    const bTime = billing_time || new Date().toTimeString().split(' ')[0].substring(0, 5);

    const bQty = parseInt(billed_qty || ticket.qty_in_pick_ticket, 10);
    const dQty = parseInt(damage_qty || 0, 10);
    const qtyDiff = ticket.qty_in_pick_ticket - bQty;
    const computedShort = qtyDiff > 0 ? qtyDiff : 0;
    const computedExcess = qtyDiff < 0 ? Math.abs(qtyDiff) : 0;

    const result = await dbAsync.run(`
      INSERT INTO billings (
        pick_ticket_id, billing_date, billing_time, bill_no, billed_qty,
        checker_id, helper_id, start_time, end_time, invoice_amount,
        short_qty, excess_qty, damage_qty, billing_remarks, warehouse_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      pick_ticket_id,
      bDate,
      bTime,
      bill_no,
      bQty,
      checker_id || null,
      helper_id || null,
      start_time || new Date().toISOString(),
      end_time || new Date().toISOString(),
      parseFloat(invoice_amount || 0),
      short_qty !== undefined ? parseInt(short_qty, 10) : computedShort,
      excess_qty !== undefined ? parseInt(excess_qty, 10) : computedExcess,
      dQty,
      billing_remarks || '',
      whId,
      req.user ? req.user.username : 'System'
    ]);

    // Update Pick Ticket status to Billed
    await dbAsync.run("UPDATE pick_tickets SET status = 'Billed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [pick_ticket_id]);

    // Audit log
    await logAudit(req, {
      action_type: 'CREATE',
      module: 'Billing',
      target_id: bill_no,
      details: `Created Billing Invoice ${bill_no} for Pick Ticket ${ticket.ticket_no} (Invoice Amount: ₹${invoice_amount || 0})`,
      changed_fields: { invoice_amount: invoice_amount || 0, status: 'Billed' }
    });

    return res.json({
      message: `Invoice Bill ${bill_no} created successfully!`,
      id: result.id,
      bill_no
    });
  } catch (err) {
    console.error('Create billing error:', err);
    return res.status(500).json({ message: 'Error creating billing invoice.' });
  }
}

async function updateBilling(req, res) {
  try {
    const { id } = req.params;
    const {
      pick_ticket_id,
      billing_date,
      billing_time,
      bill_no,
      billed_qty,
      checker_id,
      helper_id,
      start_time,
      end_time,
      invoice_amount,
      short_qty,
      excess_qty,
      damage_qty,
      billing_remarks
    } = req.body;

    const billing = await dbAsync.get('SELECT * FROM billings WHERE id = ?', [id]);
    if (!billing) {
      return res.status(404).json({ message: 'Billing record not found.' });
    }

    const linkedPt = await dbAsync.get('SELECT status FROM pick_tickets WHERE id = ?', [billing.pick_ticket_id]);
    if (linkedPt && (linkedPt.status === 'Dispatched' || linkedPt.status === 'Delivered')) {
      return res.status(400).json({ message: 'Cannot edit billing invoice for a Dispatched or Delivered pick ticket.' });
    }

    await dbAsync.run(`
      UPDATE billings
      SET pick_ticket_id = ?, billing_date = ?, billing_time = ?, bill_no = ?,
          billed_qty = ?, checker_id = ?, helper_id = ?, start_time = ?, end_time = ?,
          invoice_amount = ?, short_qty = ?, excess_qty = ?, damage_qty = ?,
          billing_remarks = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      pick_ticket_id || billing.pick_ticket_id,
      billing_date || billing.billing_date,
      billing_time || billing.billing_time,
      bill_no || billing.bill_no,
      billed_qty !== undefined ? parseInt(billed_qty, 10) : billing.billed_qty,
      checker_id || billing.checker_id,
      helper_id || billing.helper_id,
      start_time || billing.start_time,
      end_time || billing.end_time,
      invoice_amount !== undefined ? parseFloat(invoice_amount) : billing.invoice_amount,
      short_qty !== undefined ? parseInt(short_qty, 10) : billing.short_qty,
      excess_qty !== undefined ? parseInt(excess_qty, 10) : billing.excess_qty,
      damage_qty !== undefined ? parseInt(damage_qty, 10) : billing.damage_qty,
      billing_remarks !== undefined ? billing_remarks : billing.billing_remarks,
      req.user ? req.user.username : 'System',
      id
    ]);

    return res.json({ message: `Invoice Bill ${billing.bill_no} updated successfully!` });
  } catch (err) {
    console.error('Update billing error:', err);
    return res.status(500).json({ message: 'Error updating billing record.' });
  }
}

async function deleteBilling(req, res) {
  try {
    const { id } = req.params;
    const billing = await dbAsync.get('SELECT * FROM billings WHERE id = ?', [id]);
    if (!billing) {
      return res.status(404).json({ message: 'Billing record not found.' });
    }

    const linkedPt = await dbAsync.get('SELECT status FROM pick_tickets WHERE id = ?', [billing.pick_ticket_id]);
    if (linkedPt && (linkedPt.status === 'Dispatched' || linkedPt.status === 'Delivered')) {
      return res.status(400).json({ message: 'Cannot delete billing invoice for a Dispatched or Delivered pick ticket.' });
    }

    await dbAsync.run('DELETE FROM billings WHERE id = ?', [id]);
    if (billing.pick_ticket_id) {
      await dbAsync.run("UPDATE pick_tickets SET status = 'Picked' WHERE id = ?", [billing.pick_ticket_id]);
    }

    await logAudit(req, {
      action_type: 'DELETE',
      module: 'Billing',
      target_id: billing.bill_no || `ID #${id}`,
      details: `Deleted Invoice ${billing.bill_no} and reset linked pick ticket status to Picked`,
      changed_fields: null
    });

    return res.json({ message: 'Billing record deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Error deleting billing record.' });
  }
}

module.exports = {
  getBillings,
  getPendingTickets,
  suggestNextBillNo,
  createBilling,
  updateBilling,
  deleteBilling
};
