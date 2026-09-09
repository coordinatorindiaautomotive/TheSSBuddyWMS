const { dbAsync } = require('../config/db');

async function getDispatches(req, res) {
  try {
    const whId = req.activeWarehouseId;
    const dispatches = await dbAsync.all(`
      SELECT d.*, drv.name as driver_name, drv.phone as driver_phone, v.vehicle_number,
             (SELECT COUNT(*) FROM dispatch_parties WHERE dispatch_id = d.id) as party_count
      FROM dispatches d
      LEFT JOIN drivers drv ON d.driver_id = drv.id
      LEFT JOIN vehicles v ON d.vehicle_id = v.id
      WHERE d.warehouse_id = ?
      ORDER BY d.created_at DESC
    `, [whId]);

    return res.json(dispatches);
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching dispatches.' });
  }
}

async function getDispatchById(req, res) {
  try {
    const { id } = req.params;
    const dispatch = await dbAsync.get(`
      SELECT d.*, drv.name as driver_name, drv.phone as driver_phone, v.vehicle_number
      FROM dispatches d
      LEFT JOIN drivers drv ON d.driver_id = drv.id
      LEFT JOIN vehicles v ON d.vehicle_id = v.id
      WHERE d.id = ?
    `, [id]);

    if (!dispatch) {
      return res.status(404).json({ message: 'Dispatch not found.' });
    }

    const parties = await dbAsync.all(`
      SELECT dp.*, p.party_name, p.address, p.city, p.phone, p.lat, p.lng, b.bill_no, b.invoice_amount
      FROM dispatch_parties dp
      JOIN parties p ON dp.party_code = p.party_code AND p.warehouse_id = dp.warehouse_id
      JOIN billings b ON dp.billing_id = b.id
      WHERE dp.dispatch_id = ?
    `, [id]);

    const cartons = await dbAsync.all(`
      SELECT * FROM cartons WHERE dispatch_id = ?
    `, [id]);

    return res.json({
      ...dispatch,
      parties,
      cartons
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching dispatch details.' });
  }
}

async function scanCarton(req, res) {
  try {
    const { id } = req.params;
    const { barcode_no } = req.body;

    if (!barcode_no) {
      return res.status(400).json({ message: 'Barcode number is required.' });
    }

    const carton = await dbAsync.get('SELECT * FROM cartons WHERE barcode_no = ? AND dispatch_id = ?', [barcode_no, id]);
    if (!carton) {
      return res.status(404).json({ message: 'Carton barcode not found in this dispatch.' });
    }

    if (carton.is_scanned) {
      return res.status(400).json({ message: 'Carton already scanned.' });
    }

    // Update carton status
    await dbAsync.run('UPDATE cartons SET is_scanned = 1, scanned_at = CURRENT_TIMESTAMP WHERE id = ?', [carton.id]);

    // Update dispatch_parties scanned count
    await dbAsync.run('UPDATE dispatch_parties SET scanned_cartons = scanned_cartons + 1 WHERE id = ?', [carton.dispatch_party_id]);

    // Update dispatch scanned count
    await dbAsync.run('UPDATE dispatches SET scanned_cartons = scanned_cartons + 1 WHERE id = ?', [id]);

    // Check if dispatch loading complete
    const dispatch = await dbAsync.get('SELECT * FROM dispatches WHERE id = ?', [id]);
    if (dispatch.scanned_cartons >= dispatch.total_cartons) {
      await dbAsync.run("UPDATE dispatches SET status = 'In Transit' WHERE id = ?", [id]);
    }

    return res.json({
      message: 'Carton scanned successfully!',
      carton_id: carton.id,
      scanned_cartons: dispatch.scanned_cartons + 1,
      total_cartons: dispatch.total_cartons
    });
  } catch (err) {
    console.error('Scan carton error:', err);
    return res.status(500).json({ message: 'Error scanning carton.' });
  }
}

async function updateDispatchStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await dbAsync.run('UPDATE dispatches SET status = ? WHERE id = ?', [status, id]);

    if (status === 'Completed' || status === 'Cancelled') {
      const dispatch = await dbAsync.get('SELECT * FROM dispatches WHERE id = ?', [id]);
      if (dispatch) {
        await dbAsync.run("UPDATE drivers SET status = 'Available' WHERE id = ?", [dispatch.driver_id]);
        await dbAsync.run("UPDATE vehicles SET status = 'Available' WHERE id = ?", [dispatch.vehicle_id]);
      }
    }

    return res.json({ message: `Dispatch status updated to ${status}` });
  } catch (err) {
    return res.status(500).json({ message: 'Error updating dispatch status.' });
  }
}

module.exports = {
  getDispatches,
  getDispatchById,
  scanCarton,
  updateDispatchStatus
};
