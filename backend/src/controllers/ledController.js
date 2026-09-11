const ledService = require('../services/ledService');
const { dbAsync } = require('../config/db');

/**
 * GET /api/led/dashboard
 * Main endpoint providing dashboard data, KPIs, dispatch cycles, next dispatch, and ticket list
 */
async function getLedDashboard(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const data = await ledService.getLedDashboardData(req.query, whId);
    return res.json(data);
  } catch (err) {
    console.error('Error fetching LED dashboard:', err);
    return res.status(500).json({ message: err.message || 'Error fetching LED dashboard data.' });
  }
}

/**
 * GET /api/led/summary
 * Returns high-level KPI card metrics
 */
async function getLedSummary(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const data = await ledService.getLedDashboardData(req.query, whId);
    return res.json({
      kpis: data.kpis,
      nextDispatch: data.nextDispatch,
      currentTime: data.currentTime,
      date: data.date
    });
  } catch (err) {
    console.error('Error fetching LED summary:', err);
    return res.status(500).json({ message: 'Error fetching LED summary.' });
  }
}

/**
 * GET /api/led/routes
 * Returns routes with their scheduled dispatch cycles
 */
async function getLedRoutes(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const data = await ledService.getLedDashboardData(req.query, whId);
    return res.json({
      routes: data.routes,
      morningDispatch: data.morningDispatch,
      eveningDispatch: data.eveningDispatch
    });
  } catch (err) {
    console.error('Error fetching LED routes:', err);
    return res.status(500).json({ message: 'Error fetching LED routes.' });
  }
}

/**
 * GET /api/led/routes/:routeId
 * Returns specific route cycles and metrics
 */
async function getLedRouteById(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const { routeId } = req.params;
    const data = await ledService.getLedDashboardData({ ...req.query, route_id: routeId }, whId);

    const morning = data.morningDispatch.cycles.filter(c => String(c.route_id) === String(routeId));
    const evening = data.eveningDispatch.cycles.filter(c => String(c.route_id) === String(routeId));

    return res.json({
      route_id: routeId,
      morningCycles: morning,
      eveningCycles: evening,
      tickets: data.tickets
    });
  } catch (err) {
    console.error('Error fetching LED route details:', err);
    return res.status(500).json({ message: 'Error fetching LED route details.' });
  }
}

/**
 * GET /api/led/dispatch-cycles
 * Returns all active dispatch cycles for the day
 */
async function getLedDispatchCycles(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const data = await ledService.getLedDashboardData(req.query, whId);
    return res.json({
      date: data.date,
      morning: data.morningDispatch,
      evening: data.eveningDispatch
    });
  } catch (err) {
    console.error('Error fetching LED dispatch cycles:', err);
    return res.status(500).json({ message: 'Error fetching LED dispatch cycles.' });
  }
}

/**
 * GET /api/led/pick-tickets
 * Scoped pick tickets table with pagination, search, sorting
 */
async function getLedPickTickets(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const data = await ledService.getLedDashboardData(req.query, whId);
    return res.json(data.tickets);
  } catch (err) {
    console.error('Error fetching LED pick tickets:', err);
    return res.status(500).json({ message: 'Error fetching LED pick tickets.' });
  }
}

/**
 * GET /api/led/pick-tickets/:id
 * Single pick ticket details with stage timeline
 */
async function getLedPickTicketById(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const { id } = req.params;
    const ticket = await ledService.getPickTicketDetailById(id, whId);
    if (!ticket) {
      return res.status(404).json({ message: 'Pick ticket not found.' });
    }
    return res.json(ticket);
  } catch (err) {
    console.error('Error fetching LED pick ticket details:', err);
    return res.status(500).json({ message: 'Error fetching LED pick ticket details.' });
  }
}

/**
 * GET /api/led/stage-summary
 */
async function getLedStageSummary(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const summary = await ledService.getStageSummary(req.query, whId);
    return res.json(summary);
  } catch (err) {
    console.error('Error fetching LED stage summary:', err);
    return res.status(500).json({ message: 'Error fetching stage summary.' });
  }
}

/**
 * GET /api/led/party-summary
 */
async function getLedPartySummary(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const summary = await ledService.getPartySummary(req.query, whId);
    return res.json(summary);
  } catch (err) {
    console.error('Error fetching LED party summary:', err);
    return res.status(500).json({ message: 'Error fetching party summary.' });
  }
}

/**
 * GET /api/led/carton-summary
 */
async function getLedCartonSummary(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const summary = await ledService.getCartonSummary(req.query, whId);
    return res.json(summary);
  } catch (err) {
    console.error('Error fetching LED carton summary:', err);
    return res.status(500).json({ message: 'Error fetching carton summary.' });
  }
}

/**
 * GET /api/led/alerts
 */
async function getLedAlerts(req, res) {
  try {
    const whId = req.activeWarehouseId || 1;
    const data = await ledService.getLedDashboardData(req.query, whId);
    const delayedCycles = [...data.morningDispatch.cycles, ...data.eveningDispatch.cycles]
      .filter(c => c.isDelayed || c.status === 'Delayed' || c.status === 'At Risk');

    const alerts = delayedCycles.map(c => ({
      id: c.cycle_key,
      type: c.status === 'Delayed' ? 'CRITICAL' : 'WARNING',
      title: `${c.route_name} (${c.slot}) ${c.status}`,
      message: `Cutoff: ${c.cutoff_time_formatted}, Dispatch: ${c.dispatch_time_formatted} - ${c.metrics.pending} pending, ${c.metrics.delayed} delayed`,
      timeRemaining: c.timeRemaining
    }));

    return res.json(alerts);
  } catch (err) {
    console.error('Error fetching LED alerts:', err);
    return res.status(500).json({ message: 'Error fetching LED alerts.' });
  }
}

module.exports = {
  getLedDashboard,
  getLedSummary,
  getLedRoutes,
  getLedRouteById,
  getLedDispatchCycles,
  getLedPickTickets,
  getLedPickTicketById,
  getLedStageSummary,
  getLedPartySummary,
  getCartonSummary: getLedCartonSummary,
  getLedAlerts
};