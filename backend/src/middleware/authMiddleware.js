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

    const roleNorm = String(decoded.role || decoded.role_name || '').toLowerCase().replace(/[^a-z]/g, '');
    const userNorm = String(decoded.username || decoded.email || '').toLowerCase();
    const isSuperAdmin = !roleNorm.includes('warehouse') && (
      roleNorm === 'superadmin' || 
      roleNorm === 'super' || 
      Boolean(decoded.is_super_admin) ||
      userNorm === 'superadmin' ||
      (userNorm === 'admin' && roleNorm !== 'warehouseadmin')
    );

    const headerWhId = req.headers['x-warehouse-id'];

    if (headerWhId && (isSuperAdmin || !decoded.warehouse_id)) {
      req.activeWarehouseId = parseInt(headerWhId, 10);
    } else if (decoded.warehouse_id) {
      req.activeWarehouseId = (headerWhId && isSuperAdmin) ? parseInt(headerWhId, 10) : parseInt(decoded.warehouse_id, 10);
    } else {
      req.activeWarehouseId = headerWhId ? parseInt(headerWhId, 10) : 1;
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const roleNorm = String(req.user.role || req.user.role_name || '').toLowerCase().replace(/[^a-z]/g, '');
  const userNorm = String(req.user.username || req.user.email || '').toLowerCase();
  const isSuperAdmin = !roleNorm.includes('warehouse') && (
    roleNorm === 'superadmin' || 
    roleNorm === 'super' || 
    Boolean(req.user.is_super_admin) ||
    userNorm === 'superadmin' ||
    (userNorm === 'admin' && roleNorm !== 'warehouseadmin')
  );
  if (!isSuperAdmin) {
    return res.status(403).json({ message: 'Forbidden: Super Admin privileges required.' });
  }
  next();
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
  requireSuperAdmin,
  authorizeRoles
};

