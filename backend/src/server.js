const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { initDatabase, dbAsync } = require('./config/db');
const { authenticate } = require('./middleware/authMiddleware');
const { startDispatchMonitor } = require('./services/dispatchMonitorService');

// Controllers
const authController = require('./controllers/authController');
const dashboardController = require('./controllers/dashboardController');
const dispatchPlanningController = require('./controllers/dispatchPlanningController');
const dispatchController = require('./controllers/dispatchController');
const deliveryController = require('./controllers/deliveryController');
const ewaybillController = require('./controllers/ewaybillController');
const pickTicketController = require('./controllers/pickTicketController');
const billingController = require('./controllers/billingController');
const partyController = require('./controllers/partyController');
const masterController = require('./controllers/masterController');
const importController = require('./controllers/importController');
const leaderboardController = require('./controllers/leaderboardController');
const reportController = require('./controllers/reportController');
const trackingController = require('./controllers/trackingController');
const mobileApiController = require('./controllers/mobileApiController');
const auditLogController = require('./controllers/auditLogController');
const systemSettingsController = require('./controllers/systemSettingsController');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  req.io = io;
  next();
});

const upload = multer({ storage: multer.memoryStorage() });

// Public Routes
app.post('/api/auth/login', authController.login);
app.post('/api/mobile/auth/login', mobileApiController.mobileLogin);

// Protected Routes Middleware
app.use('/api', authenticate);

// Auth & User Profile
app.get('/api/auth/me', authController.me);
app.post('/api/auth/switch-warehouse', authController.switchWarehouse);

// Dashboard
app.get('/api/dashboard/stats', dashboardController.getStats);

// Pick Tickets API
app.get('/api/pick-tickets', pickTicketController.getPickTickets);
app.get('/api/pick-tickets/suggest-next-no', pickTicketController.suggestNextNo);
app.get('/api/pick-tickets/validate-number', pickTicketController.validateNumber);
app.get('/api/pick-tickets/:id', pickTicketController.getPickTicketById);
app.post('/api/pick-tickets', pickTicketController.createPickTicket);
app.put('/api/pick-tickets/:id', pickTicketController.updatePickTicket);
app.delete('/api/pick-tickets/:id', pickTicketController.deletePickTicket);

// Billings API
app.get('/api/billings', billingController.getBillings);
app.get('/api/billings/pending-tickets', billingController.getPendingTickets);
app.get('/api/billings/suggest-next-no', billingController.suggestNextBillNo);
app.post('/api/billings', billingController.createBilling);
app.put('/api/billings/:id', billingController.updateBilling);
app.delete('/api/billings/:id', billingController.deleteBilling);

// Parties API
app.get('/api/parties', partyController.getParties);
app.get('/api/parties/code/:code', partyController.getPartyByCode);
app.post('/api/parties', partyController.createParty);
app.put('/api/parties/:id', partyController.updateParty);
app.delete('/api/parties/:id', partyController.deleteParty);

// Dispatch Planning & Operations Console API
app.get('/api/dispatch-planning/console-data', dispatchPlanningController.getOperationsConsole);
app.post('/api/dispatch-planning/create-on-demand', dispatchPlanningController.createOnDemandDispatch);
app.get('/api/dispatch-planning/data', dispatchPlanningController.getPlanningData);
app.post('/api/dispatch-planning/create-trip', dispatchPlanningController.createTrip);
app.get('/api/dispatch-planning/bill-status', dispatchPlanningController.getPartyBillStatus);
app.post('/api/dispatch-planning/mark-dispatched', dispatchPlanningController.markTicketsDispatched);

// Dispatches API
app.get('/api/dispatches', dispatchController.getDispatches);
app.get('/api/dispatches/:id', dispatchController.getDispatchById);
app.post('/api/dispatches/:id/scan', dispatchController.scanCarton);
app.put('/api/dispatches/:id/status', dispatchController.updateDispatchStatus);

// Delivery Board API
app.get('/api/delivery', deliveryController.getDeliveryBoard);
app.put('/api/delivery/:id/status', deliveryController.updateDeliveryStatus);

// E-Way Bills API
app.get('/api/ewaybill', ewaybillController.getEWayBills);
app.post('/api/ewaybill/upload', upload.single('file'), ewaybillController.uploadExcel);
app.get('/api/ewaybill/export-json', ewaybillController.exportJson);

// Master Registries API (Full CRUD for All Sub-Masters & Route Schedules)
app.get('/api/masters/warehouses', masterController.getWarehouses);
app.post('/api/masters/warehouses', masterController.createWarehouse);
app.put('/api/masters/warehouses/:id', masterController.updateWarehouse);
app.delete('/api/masters/warehouses/:id', masterController.deleteWarehouse);

app.get('/api/masters/routes', masterController.getRoutes);
app.post('/api/masters/routes', masterController.createRoute);
app.put('/api/masters/routes/:id', masterController.updateRoute);
app.delete('/api/masters/routes/:id', masterController.deleteRoute);

// Route Schedules Sub-Master API
app.get('/api/masters/routes/:routeId/schedules', masterController.getRouteSchedules);
app.post('/api/masters/routes/:routeId/schedules', masterController.createRouteSchedule);
app.post('/api/masters/routes/schedules', masterController.createRouteSchedule);
app.put('/api/masters/routes/:routeId/schedules/:scheduleId', masterController.updateRouteSchedule);
app.put('/api/masters/routes/schedules/:scheduleId', masterController.updateRouteSchedule);
app.delete('/api/masters/routes/:routeId/schedules/:scheduleId', masterController.deleteRouteSchedule);
app.delete('/api/masters/routes/schedules/:scheduleId', masterController.deleteRouteSchedule);

app.get('/api/masters/workers', masterController.getWorkers);
app.post('/api/masters/workers', masterController.createWorker);
app.put('/api/masters/workers/:id', masterController.updateWorker);
app.delete('/api/masters/workers/:id', masterController.deleteWorker);

app.get('/api/masters/salesmen', masterController.getSalesmen);
app.post('/api/masters/salesmen', masterController.createSalesman);
app.put('/api/masters/salesmen/:id', masterController.updateSalesman);
app.delete('/api/masters/salesmen/:id', masterController.deleteSalesman);

app.get('/api/masters/drivers', masterController.getDrivers);
app.post('/api/masters/drivers', masterController.createDriver);
app.put('/api/masters/drivers/:id', masterController.updateDriver);
app.delete('/api/masters/drivers/:id', masterController.deleteDriver);

app.get('/api/masters/vehicles', masterController.getVehicles);
app.post('/api/masters/vehicles', masterController.createVehicle);
app.put('/api/masters/vehicles/:id', masterController.updateVehicle);
app.delete('/api/masters/vehicles/:id', masterController.deleteVehicle);

app.get('/api/masters/users', masterController.getUsers);
app.post('/api/masters/users', masterController.createUser);
app.put('/api/masters/users/:id', masterController.updateUser);
app.delete('/api/masters/users/:id', masterController.deleteUser);

// Bulk Import
app.post('/api/import/upload', upload.single('file'), importController.importExcel);

// Leaderboard, Audit Logs & Reports
app.get('/api/leaderboard', leaderboardController.getLeaderboard);
app.get('/api/reports/lifecycle', reportController.getEndToEndLifecycleReport);
app.get('/api/reports/detailed-lifecycle', reportController.getGranularAuditReport);
app.get('/api/audit-logs', auditLogController.getAuditLogs);
app.get('/api/reports/dispatch', reportController.getDispatchReport);
app.get('/api/reports/billing', reportController.getBillingReport);

// Live Tracking
app.get('/api/tracking/active', trackingController.getActiveTracking);
app.post('/api/tracking/update-location', trackingController.updateLocation);

// Mobile Driver App Routes
app.get('/api/mobile/dispatches', mobileApiController.getAssignedDispatches);

// System Settings & 1-Click Database Auto-Sync
app.get('/api/system/config', systemSettingsController.getSystemConfig);
app.post('/api/system/config', systemSettingsController.updateSystemConfig);
app.post('/api/system/test-db', systemSettingsController.testDatabaseConnection);
app.post('/api/system/sync-db', systemSettingsController.autoSyncDatabase);

// Socket.io Realtime Events
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('joinWarehouse', (warehouseId) => {
    socket.join(`warehouse_${warehouseId}`);
  });
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Serve Production Built Frontend Static Files
const possibleDistPaths = [
  path.join(__dirname, '../../frontend/dist'),
  path.join(__dirname, '../public'),
  path.join(__dirname, '../../public'),
  path.join(process.cwd(), 'frontend/dist'),
  path.join(process.cwd(), 'public'),
  process.cwd()
];

let activeDistPath = null;
for (const p of possibleDistPaths) {
  if (fs.existsSync(path.join(p, 'index.html')) && p !== path.join(__dirname, '..')) {
    activeDistPath = p;
    break;
  }
}

if (activeDistPath) {
  console.log(`📦 Serving Frontend Static Assets from: ${activeDistPath}`);
  app.use(express.static(activeDistPath));
  app.use('/TheSSBuddyWMS', express.static(activeDistPath));
  app.use('/TheSSBuddyWMS/assets', express.static(path.join(activeDistPath, 'assets')));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/assets') || req.path.startsWith('/TheSSBuddyWMS/assets')) return next();
    res.sendFile(path.join(activeDistPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;

initDatabase().then(() => {
  startDispatchMonitor(io);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TheSSBuddy Enterprise Backend running on ALL LAN IPs -> http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error('Database Initialization Error:', err);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend running on http://0.0.0.0:${PORT} (Degraded mode)`);
  });
});
