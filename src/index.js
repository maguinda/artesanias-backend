// src/index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const logger  = require('./utils/logger');

const authRouter       = require('./routes/auth');
const productsRouter   = require('./routes/products');
const categoriesRouter = require('./routes/categories');
const cartRouter       = require('./routes/cart');
const ordersRouter     = require('./routes/orders');
const customersRouter  = require('./routes/customers');
const paymentRouter    = require('./routes/payment');
const googleRouter     = require('./routes/google');
const uploadRouter     = require('./routes/upload');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares globales ──────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// ── Logging de cada request ───────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms     = Date.now() - start;
    const level  = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('http', `${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',        authRouter);
app.use('/api/products',    productsRouter);
app.use('/api/categories',  categoriesRouter);
app.use('/api/cart',        cartRouter);
app.use('/api/orders',      ordersRouter);
app.use('/api/customers',   customersRouter);
app.use('/api/payment',     paymentRouter);
app.use('/api/auth/google', googleRouter);
app.use('/api/upload',      uploadRouter);

// Servir imágenes subidas de forma estática
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => {
  logger.warn('http', `404 ${req.method} ${req.path}`);
  res.status(404).json({ error: `Ruta ${req.method} ${req.path} no existe` });
});

// ── Manejador global de errores ───────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('express', err.message, err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Error interno del servidor' : err.message,
  });
});

app.listen(PORT, () => {
  logger.info('server', `Artesanías Colombianas API corriendo en http://localhost:${PORT}`);
  logger.info('server', 'Logs guardados en: logs/app.log');
  console.log(`
✅  Artesanías Colombianas API corriendo en http://localhost:${PORT}

    Rutas disponibles:
      POST   /api/auth/register
      POST   /api/auth/login
      GET    /api/auth/me
      PUT    /api/auth/me
      POST   /api/auth/google

      GET    /api/products
      POST   /api/products           (admin)
      PUT    /api/products/:id       (admin)
      DELETE /api/products/:id       (admin)

      GET    /api/categories
      POST   /api/categories         (admin)
      PUT    /api/categories/:id     (admin)
      DELETE /api/categories/:id     (admin)

      GET    /api/cart
      POST   /api/cart
      PUT    /api/cart/:itemId
      DELETE /api/cart/:itemId
      DELETE /api/cart               (vaciar)

      POST   /api/orders
      GET    /api/orders
      GET    /api/orders/:id
      PATCH  /api/orders/:id/status  (admin)
      DELETE /api/orders/:id

      GET    /api/customers          (admin)
      GET    /api/customers/:id      (admin)
      POST   /api/customers          (admin) ← contraseña temporal: Temporal123
      PUT    /api/customers/:id      (admin)
      DELETE /api/customers/:id      (admin)

      POST   /api/payment
      POST   /api/upload/image       (admin)

    Logs en: logs/app.log
`);
});
