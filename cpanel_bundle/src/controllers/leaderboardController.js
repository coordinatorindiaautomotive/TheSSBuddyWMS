const { dbAsync } = require('../config/db');

function formatSqlDateTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function getLeaderboard(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const period = req.query.period || 'weekly';

    const now = new Date();
    let startDate = '';

    if (period === 'hourly') {
      startDate = formatSqlDateTime(new Date(now.getTime() - 60 * 60 * 1000));
    } else if (period === 'today' || period === 'daily') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      startDate = formatSqlDateTime(todayStart);
    } else if (period === 'weekly') {
      startDate = formatSqlDateTime(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    } else if (period === 'monthly') {
      startDate = formatSqlDateTime(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    }
    // period === 'all' has empty startDate

    const ptDateClause = startDate ? ` AND (pt.created_at >= '${startDate}' OR pt.date >= '${startDate.split(' ')[0]}')` : '';
    const bDateClause = startDate ? ` AND (b.created_at >= '${startDate}' OR b.billing_date >= '${startDate.split(' ')[0]}')` : '';

    // 1. Pickers Performance (Ranked by units picked)
    const rawPickers = await dbAsync.all(`
      SELECT 
        pkh.id, 
        pkh.name, 
        pkh.employee_code,
        pkh.phone,
        COUNT(CASE WHEN pt.id IS NOT NULL THEN 1 END) as count, 
        COALESCE(SUM(CASE WHEN pt.status IN ('Picked', 'Billed', 'Dispatched') THEN pt.qty_in_pick_ticket ELSE 0 END), 0) as score,
        COALESCE(SUM(CASE WHEN pt.status IN ('Picked', 'Billed', 'Dispatched') THEN 1 ELSE 0 END), 0) as completed_tickets,
        COALESCE(SUM(CASE WHEN pt.status = 'Assigned' THEN 1 ELSE 0 END), 0) as pending_tickets
      FROM picker_checker_helpers pkh
      LEFT JOIN pick_tickets pt ON (pkh.id = pt.picker_id OR pkh.employee_code = pt.picker_id OR pkh.name = pt.picker_id) ${ptDateClause}
      WHERE (pkh.warehouse_id = ? OR ? = 0) AND pkh.role = 'Picker' AND pkh.is_active = 1
      GROUP BY pkh.id, pkh.name, pkh.employee_code, pkh.phone
      ORDER BY score DESC, count DESC
    `, [whId, whId]);

    const maxPickerScore = rawPickers.length > 0 && rawPickers[0].score > 0 ? rawPickers[0].score : 1;
    const pickers = rawPickers.map((p, idx) => ({
      ...p,
      rank: idx + 1,
      metric: 'Units Picked',
      score: Number(p.score || 0),
      count: Number(p.count || 0),
      barWidth: Math.round((Number(p.score || 0) / maxPickerScore) * 100)
    }));

    // 2. Checkers Performance (Ranked by qty checked)
    const rawCheckers = await dbAsync.all(`
      SELECT 
        pkh.id, 
        pkh.name, 
        pkh.employee_code,
        pkh.phone,
        COUNT(b.id) as count, 
        COALESCE(SUM(b.billed_qty), 0) as score,
        COALESCE(SUM(b.invoice_amount), 0) as total_invoice_val
      FROM picker_checker_helpers pkh
      LEFT JOIN billings b ON (pkh.id = b.checker_id OR pkh.employee_code = b.checker_id OR pkh.name = b.checker_id) ${bDateClause}
      WHERE (pkh.warehouse_id = ? OR ? = 0) AND pkh.role = 'Checker' AND pkh.is_active = 1
      GROUP BY pkh.id, pkh.name, pkh.employee_code, pkh.phone
      ORDER BY score DESC, count DESC
    `, [whId, whId]);

    const maxCheckerScore = rawCheckers.length > 0 && rawCheckers[0].score > 0 ? rawCheckers[0].score : 1;
    const checkers = rawCheckers.map((c, idx) => ({
      ...c,
      rank: idx + 1,
      metric: 'Qty Checked',
      score: Number(c.score || 0),
      count: Number(c.count || 0),
      barWidth: Math.round((Number(c.score || 0) / maxCheckerScore) * 100)
    }));

    // 3. Helpers Performance (Ranked by billings assisted)
    const rawHelpers = await dbAsync.all(`
      SELECT 
        pkh.id, 
        pkh.name, 
        pkh.employee_code,
        pkh.phone,
        COUNT(b.id) as count, 
        COALESCE(SUM(b.billed_qty), 0) as score
      FROM picker_checker_helpers pkh
      LEFT JOIN billings b ON (pkh.id = b.helper_id OR pkh.employee_code = b.helper_id OR pkh.name = b.helper_id) ${bDateClause}
      WHERE (pkh.warehouse_id = ? OR ? = 0) AND pkh.role = 'Helper' AND pkh.is_active = 1
      GROUP BY pkh.id, pkh.name, pkh.employee_code, pkh.phone
      ORDER BY score DESC, count DESC
    `, [whId, whId]);

    const maxHelperScore = rawHelpers.length > 0 && rawHelpers[0].score > 0 ? rawHelpers[0].score : 1;
    const helpers = rawHelpers.map((h, idx) => ({
      ...h,
      rank: idx + 1,
      metric: 'Qty Assisted',
      score: Number(h.score || 0),
      count: Number(h.count || 0),
      barWidth: Math.round((Number(h.score || 0) / maxHelperScore) * 100)
    }));

    // Calculate Summary Metrics
    const totalUnitsPicked = pickers.reduce((acc, p) => acc + (p.score || 0), 0);
    const totalQtyChecked = checkers.reduce((acc, c) => acc + (c.score || 0), 0);
    const totalQtyAssisted = helpers.reduce((acc, h) => acc + (h.score || 0), 0);

    const topPicker = pickers.find(p => p.score > 0) || pickers[0] || null;
    const topChecker = checkers.find(c => c.score > 0) || checkers[0] || null;
    const topHelper = helpers.find(h => h.score > 0) || helpers[0] || null;

    return res.json({
      period,
      pickers,
      checkers,
      helpers,
      summary: {
        totalUnitsPicked,
        totalQtyChecked,
        totalQtyAssisted,
        totalActiveStaff: pickers.length + checkers.length + helpers.length,
        topPicker: topPicker ? { name: topPicker.name, score: topPicker.score, count: topPicker.count } : null,
        topChecker: topChecker ? { name: topChecker.name, score: topChecker.score, count: topChecker.count } : null,
        topHelper: topHelper ? { name: topHelper.name, score: topHelper.score, count: topHelper.count } : null
      },
      generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    return res.status(500).json({ message: 'Error fetching leaderboard.' });
  }
}

module.exports = {
  getLeaderboard
};

