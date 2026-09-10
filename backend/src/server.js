require('dotenv').config();
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

// Normalize subpath prefix for cPanel deployments (e.g. /TheSSBuddyWMS/api -> /api)
app.use((req, res, next) => {
  if (req.url.startsWith('/TheSSBuddyWMS/')) {
    req.url = req.url.substring('/TheSSBuddyWMS'.length);
  } else if (req.url === '/TheSSBuddyWMS') {
    req.url = '/';
  }
  next();
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

const upload = multer({ storage: multer.memoryStorage() });

const apiRouter = express.Router();

// Public Routes
apiRouter.post('/auth/login', authController.login);
apiRouter.post('/mobile/auth/login', mobileApiController.mobileLogin);

// Protected Routes Middleware
apiRouter.use(authenticate);

// Auth & User Profile
apiRouter.get('/auth/me', authController.me);
apiRouter.post('/auth/switch-warehouse', authController.switchWarehouse);

// Dashboard
apiRouter.get('/dashboard/stats', dashboardController.getStats);

// Pick Tickets API
apiRouter.get('/pick-tickets', pickTicketController.getPickTickets);
apiRouter.get('/pick-tickets/suggest-next-no', pickTicketController.suggestNextNo);
apiRouter.get('/pick-tickets/validate-number', pickTicketController.validateNumber);
apiRouter.get('/pick-tickets/:id', pickTicketController.getPickTicketById);
apiRouter.post('/pick-tickets', pickTicketController.createPickTicket);
apiRouter.put('/pick-tickets/:id', pickTicketController.updatePickTicket);
apiRouter.delete('/pick-tickets/:id', pickTicketController.deletePickTicket);

// Billing & Invoicing API
apiRouter.get('/billing/bills', billingController.getBills);
apiRouter.get('/billing/suggest-next-no', billingController.suggestNextNo);
apiRouter.get('/billing/pending-tickets', billingController.getPendingTickets);
apiRouter.post('/billing/generate', billingController.generateBill);
apiRouter.get('/billing/bills/:id', billingController.getBillById);
apiRouter.put('/billing/bills/:id', billingController.updateBill);
apiRouter.delete('/billing/bills/:id', billingController.deleteBill);
apiRouter.post('/billing/bulk-approve', billingController.bulkApproveBills);
apiRouter.post('/billing/cancel', billingController.cancelBill);

// Route-Bill Status Matrix API
apiRouter.get('/route-bill-status/matrix', dispatchPlanningController.getMatrix);

// Dispatch Planning API
apiRouter.get('/dispatch/available-bills', dispatchPlanningController.getAvailableBills);
apiRouter.post('/dispatch/plan', dispatchPlanningController.createPlan);
apiRouter.post('/dispatch/auto-plan', dispatchPlanningController.autoPlan);

// Dispatch Execution API
apiRouter.get('/dispatch', dispatchController.getDispatches);
apiRouter.get('/dispatch/:id', dispatchController.getDispatchById);
apiRouter.post('/dispatch/:id/update-stage', dispatchController.updateStage);
apiRouter.post('/dispatch/:id/assign-staff', dispatchController.assignStaff);
apiRouter.post('/dispatch/:id/mark-ready', dispatchController.markReady);
apiRouter.post('/dispatch/:id/verify-driver', dispatchController.verifyDriver);
apiRouter.post('/dispatch/:id/complete-loading', dispatchController.completeLoading);
apiRouter.post('/dispatch/:id/out-for-delivery', dispatchController.outForDelivery);
apiRouter.post('/dispatch/:id/complete-dispatch', dispatchController.completeDispatch);

// Delivery Tracking & ePOD API
apiRouter.get('/delivery/board', deliveryController.getDeliveryBoard);
apiRouter.post('/delivery/:id/epod', upload.single('podPhoto'), deliveryController.submitEpod);
apiRouter.post('/delivery/:id/mark-delivered', deliveryController.markDelivered);

// E-Way Bill Integration API
apiRouter.get('/ewaybill/status', ewaybillController.getStatuses);
apiRouter.post('/ewaybill/generate', ewaybillController.generateEWayBill);
apiRouter.post('/ewaybill/bulk-generate', ewaybillController.bulkGenerate);
apiRouter.post('/ewaybill/extend-validity', ewaybillController.extendValidity);
apiRouter.post('/ewaybill/cancel', ewaybillController.cancelEWayBill);

// Master Registries API
apiRouter.get('/parties', partyController.getParties);
apiRouter.post('/parties', partyController.createParty);
apiRouter.put('/parties/:id', partyController.updateParty);
apiRouter.delete('/parties/:id', partyController.deleteParty);

apiRouter.get('/masters/warehouses', masterController.getWarehouses);
apiRouter.post('/masters/warehouses', masterController.createWarehouse);
apiRouter.put('/masters/warehouses/:id', masterController.updateWarehouse);
apiRouter.delete('/masters/warehouses/:id', masterController.deleteWarehouse);

apiRouter.get('/masters/workers', masterController.getWorkers);
apiRouter.post('/masters/workers', masterController.createWorker);
apiRouter.put('/masters/workers/:id', masterController.updateWorker);
apiRouter.delete('/masters/workers/:id', masterController.deleteWorker);

apiRouter.get('/masters/routes', masterController.getRoutes);
apiRouter.post('/masters/routes', masterController.createRoute);
apiRouter.put('/masters/routes/:id', masterController.updateRoute);
apiRouter.delete('/masters/routes/:id', masterController.deleteRoute);
apiRouter.post('/masters/routes/:id/schedules', masterController.saveRouteSchedules);

apiRouter.get('/masters/salesmen', masterController.getSalesmen);
apiRouter.post('/masters/salesmen', masterController.createSalesman);
apiRouter.put('/masters/salesmen/:id', masterController.updateSalesman);
apiRouter.delete('/masters/salesmen/:id', masterController.deleteSalesman);

apiRouter.get('/masters/drivers', masterController.getDrivers);
apiRouter.post('/masters/drivers', masterController.createDriver);
apiRouter.put('/masters/drivers/:id', masterController.updateDriver);
apiRouter.delete('/masters/drivers/:id', masterController.deleteDriver);

apiRouter.get('/masters/vehicles', masterController.getVehicles);
apiRouter.post('/masters/vehicles', masterController.createVehicle);
apiRouter.put('/masters/vehicles/:id', masterController.updateVehicle);
apiRouter.delete('/masters/vehicles/:id', masterController.deleteVehicle);

apiRouter.get('/masters/users', masterController.getUsers);
apiRouter.post('/masters/users', masterController.createUser);
apiRouter.put('/masters/users/:id', masterController.updateUser);
apiRouter.delete('/masters/users/:id', masterController.deleteUser);

// Bulk Import
apiRouter.post('/import/upload', upload.single('file'), importController.importExcel);

// Leaderboard, Audit Logs & Reports
apiRouter.get('/leaderboard', leaderboardController.getLeaderboard);
apiRouter.get('/reports/lifecycle', reportController.getEndToEndLifecycleReport);
apiRouter.get('/reports/detailed-lifecycle', reportController.getGranularAuditReport);
apiRouter.get('/audit-logs', auditLogController.getAuditLogs);
apiRouter.get('/reports/dispatch', reportController.getDispatchReport);
apiRouter.get('/reports/billing', reportController.getBillingReport);

// Live Tracking
apiRouter.get('/tracking/active', trackingController.getActiveTracking);
apiRouter.post('/tracking/update-location', trackingController.updateLocation);

// Mobile Driver App Routes
apiRouter.get('/mobile/dispatches', mobileApiController.getAssignedDispatches);

// System Settings & 1-Click Database Auto-Sync
apiRouter.get('/system/config', systemSettingsController.getSystemConfig);
apiRouter.post('/system/config', systemSettingsController.updateSystemConfig);
apiRouter.post('/system/test-db', systemSettingsController.testDatabaseConnection);
apiRouter.post('/system/sync-db', systemSettingsController.autoSyncDatabase);

// Mount API on all possible prefixes
app.use('/api', apiRouter);
app.use('/TheSSBuddyWMS/api', apiRouter);

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
  
  // Explicitly handle all assets requests directly
  const assetsDir = path.join(activeDistPath, 'assets');
  
  app.get(['/assets/:file', '/TheSSBuddyWMS/assets/:file'], (req, res) => {
    const filePath = path.join(assetsDir, req.params.file);
    if (fs.existsSync(filePath)) {
      if (filePath.endsWith('.js')) {
        res.type('application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.type('text/css');
      }
      return res.sendFile(filePath);
    }
    res.status(404).send('Asset not found');
  });

  app.use('/assets', express.static(assetsDir));
  app.use('/TheSSBuddyWMS/assets', express.static(assetsDir));
  app.use('/TheSSBuddyWMS', express.static(activeDistPath));
  app.use(express.static(activeDistPath));

  // SPA fallback for all GET navigation routes
  app.get(['/', '/TheSSBuddyWMS', '/TheSSBuddyWMS/*'], (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.includes('/assets/')) return next();
    res.sendFile(path.join(activeDistPath, 'index.html'));
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.includes('/assets/')) return next();
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
