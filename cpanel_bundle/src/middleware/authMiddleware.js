const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'wms_enterprise_secret_jwt_key_2026';

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers['x-access-token']) {
    token = req.headers['x-access-token'];
  }

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Role-Based Warehouse Isolation Context
    const isAdmin = ['Admin', 'Super Admin', 'Warehouse Admin', 'ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_ADMIN'].includes(decoded.role);
    const headerWhId = req.headers['x-warehouse-id'];

    if (isAdmin) {
      // Admin roles can switch warehouse context via header or default to assigned warehouse
      req.activeWarehouseId = headerWhId ? parseInt(headerWhId, 10) : (decoded.warehouse_id || 1);
    } else {
      // Non-Admin staff (Picker, Checker, Helper, Operator) are STRICTLY isolated to their assigned warehouse_id
      req.activeWarehouseId = decoded.warehouse_id || 1;
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient privileges.' });
    }
    next();
  };
}

module.exports = {
  JWT_SECRET,
  authenticate,
  authorizeRoles
};
