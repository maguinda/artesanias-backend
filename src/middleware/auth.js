// src/middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET  || 'artesanias-secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '8h';

/** Verifica JWT y adjunta req.user */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/** Solo admin */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}

/** Admin O sale (vendedor) */
function requireAdminOrSale(req, res, next) {
  if (!req.user || !['admin', 'sale'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Acceso restringido a administradores y vendedores' });
  }
  next();
}

/** Admin O sale O customer autenticado (cualquier usuario logueado con rol válido) */
function requireStaff(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireAdminOrSale, requireStaff, JWT_SECRET, JWT_EXPIRES };
