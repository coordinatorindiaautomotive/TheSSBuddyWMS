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

function formatDateTimeForDb(dt) {
  if (!dt) return null;
  if (typeof dt === 'string') {
    let clean = dt.trim().replace('T', ' ').replace('Z', '').split('.')[0];
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(clean)) {
      return `${clean}:00`;
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(clean)) {
      return clean;
    }
  }
  const d = new Date(dt);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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

    const cleanBillNo = String(bill_no).trim().toUpperCase();

    // Duplicate bill check in warehouse
    const existing = await dbAsync.get('SELECT id FROM billings WHERE bill_no = ? AND warehouse_id = ?', [cleanBillNo, whId]);
    if (existing) {
      return res.status(400).json({ message: `Bill Number '${cleanBillNo}' already exists in this warehouse.` });
    }

    const ticket = await dbAsync.get('SELECT * FROM pick_tickets WHERE id = ?', [pick_ticket_id]);
    if (!ticket) {
      return res.status(404).json({ message: 'Selected Pick Ticket not found.' });
    }

    const bDate = billing_date || new Date().toISOString().split('T')[0];
    const bTime = billing_time || new Date().toTimeString().split(' ')[0].substring(0, 5);

    const bQty = parseInt(billed_qty !== undefined ? billed_qty : ticket.qty_in_pick_ticket, 10) || 0;
    const dQty = parseInt(damage_qty || 0, 10) || 0;
    const qtyDiff = (ticket.qty_in_pick_ticket || 0) - bQty;
    const computedShort = qtyDiff > 0 ? qtyDiff : 0;
    const computedExcess = qtyDiff < 0 ? Math.abs(qtyDiff) : 0;

    const sTime = formatDateTimeForDb(start_time) || formatDateTimeForDb(new Date());
    const eTime = formatDateTimeForDb(end_time) || formatDateTimeForDb(new Date());

    const result = await dbAsync.run(`
      INSERT INTO billings (
        pick_ticket_id, billing_date, billing_time, bill_no, billed_qty,
        checker_id, helper_id, start_time, end_time, invoice_amount,
        short_qty, excess_qty, damage_qty, billing_remarks, warehouse_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ticket.id,
      bDate,
      bTime,
      cleanBillNo,
      bQty,
      checker_id ? String(checker_id) : null,
      helper_id ? String(helper_id) : null,
      sTime,
      eTime,
      parseFloat(invoice_amount || 0) || 0,
      short_qty !== undefined ? parseInt(short_qty, 10) : computedShort,
      excess_qty !== undefined ? parseInt(excess_qty, 10) : computedExcess,
      dQty,
      billing_remarks || '',
      whId || ticket.warehouse_id || 1,
      req.user ? (req.user.full_name || req.user.username || 'System') : 'System'
    ]);

    // Update Pick Ticket status to Billed
    await dbAsync.run("UPDATE pick_tickets SET status = 'Billed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [ticket.id]);

    // Audit log (non-blocking)
    try {
      await logAudit(req, {
        action_type: 'CREATE',
        module: 'Billing',
        target_id: cleanBillNo,
        details: `Created Billing Invoice ${cleanBillNo} for Pick Ticket ${ticket.ticket_no} (Invoice Amount: ₹${invoice_amount || 0})`,
        changed_fields: { invoice_amount: invoice_amount || 0, status: 'Billed' }
      });
    } catch (auditErr) {
      console.warn('Billing audit log warning:', auditErr.message);
    }

    return res.json({
      message: `Invoice Bill ${cleanBillNo} created successfully!`,
      id: result.id,
      bill_no: cleanBillNo
    });
  } catch (err) {
    console.error('Create billing error:', err);
    return res.status(500).json({ message: err.message || 'Error creating billing invoice.' });
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

    const cleanBillNo = bill_no ? String(bill_no).trim().toUpperCase() : billing.bill_no;
    const sTime = formatDateTimeForDb(start_time) || billing.start_time;
    const eTime = formatDateTimeForDb(end_time) || billing.end_time;

    await dbAsync.run(`
      UPDATE billings
      SET pick_ticket_id = ?, billing_date = ?, billing_time = ?, bill_no = ?,
          billed_qty = ?, checker_id = ?, helper_id = ?, start_time = ?, end_time = ?,
          invoice_amount = ?, short_qty = ?, excess_qty = ?, damage_qty = ?,
          billing_remarks = ?
      WHERE id = ?
    `, [
      pick_ticket_id || billing.pick_ticket_id,
      billing_date || billing.billing_date,
      billing_time || billing.billing_time,
      cleanBillNo,
      billed_qty !== undefined ? parseInt(billed_qty, 10) : billing.billed_qty,
      checker_id !== undefined ? (checker_id ? String(checker_id) : null) : billing.checker_id,
      helper_id !== undefined ? (helper_id ? String(helper_id) : null) : billing.helper_id,
      sTime,
      eTime,
      invoice_amount !== undefined ? parseFloat(invoice_amount) : billing.invoice_amount,
      short_qty !== undefined ? parseInt(short_qty, 10) : billing.short_qty,
      excess_qty !== undefined ? parseInt(excess_qty, 10) : billing.excess_qty,
      damage_qty !== undefined ? parseInt(damage_qty, 10) : billing.damage_qty,
      billing_remarks !== undefined ? billing_remarks : billing.billing_remarks,
      id
    ]);

    try {
      await logAudit(req, {
        action_type: 'UPDATE',
        module: 'Billing',
        target_id: cleanBillNo,
        details: `Updated Billing Invoice ${cleanBillNo}`,
        changed_fields: { invoice_amount, billed_qty }
      });
    } catch (auditErr) {
      console.warn('Billing audit log warning:', auditErr.message);
    }

    return res.json({ message: `Invoice Bill ${cleanBillNo} updated successfully!` });
  } catch (err) {
    console.error('Update billing error:', err);
    return res.status(500).json({ message: err.message || 'Error updating billing record.' });
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
