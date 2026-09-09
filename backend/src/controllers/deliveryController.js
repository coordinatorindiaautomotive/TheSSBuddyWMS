const { dbAsync } = require('../config/db');

async function getDeliveryBoard(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const deliveries = await dbAsync.all(`
      SELECT dp.*, p.party_name, p.address, p.city, p.phone, d.dispatch_no, drv.name as driver_name, b.bill_no, b.invoice_amount
      FROM dispatch_parties dp
      JOIN parties p ON dp.party_code = p.party_code AND p.warehouse_id = dp.warehouse_id
      JOIN dispatches d ON dp.dispatch_id = d.id
      LEFT JOIN drivers drv ON d.driver_id = drv.id
      JOIN billings b ON dp.billing_id = b.id
      WHERE dp.warehouse_id = ?
      ORDER BY dp.created_at DESC
    `, [whId]);

    return res.json(deliveries);
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching delivery board.' });
  }
}

async function updateDeliveryStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, pod_signature, pod_notes } = req.body;

    if (!['Pending', 'In Transit', 'Delivered', 'Partial', 'Failed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid delivery status.' });
    }

    await dbAsync.run(`
      UPDATE dispatch_parties
      SET status = ?, pod_signature = ?, pod_notes = ?, delivered_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, pod_signature || null, pod_notes || '', id]);

    // Check if all parties in the dispatch are completed
    const dp = await dbAsync.get('SELECT dispatch_id FROM dispatch_parties WHERE id = ?', [id]);
    if (dp) {
      const remaining = await dbAsync.get(`
        SELECT COUNT(*) as count FROM dispatch_parties
        WHERE dispatch_id = ? AND status IN ('Pending', 'In Transit')
      `, [dp.dispatch_id]);

      if (remaining.count === 0) {
        await dbAsync.run("UPDATE dispatches SET status = 'Completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?", [dp.dispatch_id]);
        
        const dispatch = await dbAsync.get('SELECT * FROM dispatches WHERE id = ?', [dp.dispatch_id]);
        if (dispatch) {
          await dbAsync.run("UPDATE drivers SET status = 'Available' WHERE id = ?", [dispatch.driver_id]);
          await dbAsync.run("UPDATE vehicles SET status = 'Available' WHERE id = ?", [dispatch.vehicle_id]);
        }
      }
    }

    return res.json({ message: `Delivery status updated to ${status}` });
  } catch (err) {
    console.error('Update delivery status error:', err);
    return res.status(500).json({ message: 'Error updating delivery status.' });
  }
}

module.exports = {
  getDeliveryBoard,
  updateDeliveryStatus
};
