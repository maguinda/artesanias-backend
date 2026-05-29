// src/controllers/products.controller.js
const axios  = require('axios');
const { query, queryOne, run } = require('../models/db');
const logger = require('../utils/logger');

const EXTERNAL_API = process.env.EXTERNAL_API_BASE || 'https://mdiapiqa.gesyco.co/api/v1';
const COMPANY_ID   = process.env.COMPANY_ID || '2';

// ── Caché en memoria (RNF-02 Rendimiento) ─────────────────────────────────────
// La API externa de Gesyco tarda 8-16 segundos. Este caché guarda el resultado
// por 5 minutos. Primera carga: ~16s. Siguientes: ~50ms desde caché.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const _cache = { data: null, ts: 0 };

async function getExternalProducts(section) {
  const now = Date.now();
  // Si hay datos en caché y no han expirado, devolverlos directamente
  if (_cache.data && (now - _cache.ts) < CACHE_TTL_MS) {
    logger.info('products.cache', `Caché válido (${Math.round((CACHE_TTL_MS - (now - _cache.ts)) / 1000)}s restantes)`);
    return _cache.data;
  }
  // Llamar a la API externa
  const { data } = await axios.get(
    `${EXTERNAL_API}/catalogs/presentations/${section}`,
    { params: { company_id: COMPANY_ID, recursion: 'mixed', recursion_level: 2 }, timeout: 10000 }
  );
  const products = (Object.values(data)[3] || []).map(mapExt).filter(p => p.price > 0);
  // Guardar en caché
  _cache.data = products;
  _cache.ts   = now;
  logger.info('products.cache', `Caché actualizado — ${products.length} productos externos`);
  return products;
}
// ─────────────────────────────────────────────────────────────────────────────

// Convierte undefined → null para que mysql2 no falle
const n = (v) => (v === undefined || v === '') ? null : v;

function mapExt(el) {
  const images = Array.isArray(el.images) ? el.images : [];
  const prices = Array.isArray(el.prices) ? el.prices : [];
  return {
    id:          el.product?.id,
    sku:         el.product?.sku || String(el.product?.id),
    name:        el.product?.name,
    description: el.product?.description,
    image:       images[0] || '',
    thumbnail:   images[0] || '',
    price:       prices[0] ? parseInt(prices[0].sale_price, 10) : 0,
    brand:       el.product?.brand?.description || '',
    stock:       el.product?.stock ?? 10,
    source:      'external',
  };
}

// GET /api/products
async function getAll(req, res) {
  try {
    const { section = 'getByCompany', page = 1, limit = 20, source = 'local', category, search } = req.query;
    const pg     = Math.max(1, parseInt(page));
    const lm     = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pg - 1) * lm;

    let local = [], external = [];

    if (source === 'all' || source === 'local') {
      const params = [];
      let sql = 'SELECT * FROM products';
      const wheres = [];
      if (category) { wheres.push('category = ?');              params.push(category); }
      if (search)   { wheres.push('name LIKE ?');               params.push(`%${search}%`); }
      if (wheres.length) sql += ' WHERE ' + wheres.join(' AND ');
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(lm, offset);
      local = (await query(sql, params)).map(p => ({ ...p, source: 'local' }));
    }

    if (source === 'all' || source === 'external') {
      try {
        external = await getExternalProducts(section);
      } catch (e) {
        logger.warn('products.getAll', 'API externa no disponible', e.message);
      }
    }

    const all = [...local, ...external];
    return res.json({ products: all, total: all.length, page: pg, limit: lm });
  } catch (err) {
    logger.error('products.getAll', err.message, err.stack);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /api/products/:id
async function getOne(req, res) {
  try {
    const product = await queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    return res.json(product);
  } catch (err) {
    logger.error('products.getOne', err.message, err.stack);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST /api/products
async function create(req, res) {
  try {
    const { sku, name, price, weight, description, thumbnail, image, category, stock } = req.body;
    logger.info('products.create', `Creando producto: ${name} (SKU: ${sku})`);

    const existing = await queryOne('SELECT id FROM products WHERE sku = ?', [sku]);
    if (existing) return res.status(409).json({ error: 'Ya existe un producto con ese SKU' });

    const result = await run(
      `INSERT INTO products (sku, name, price, weight, description, thumbnail, image, category, stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        n(sku), n(name),
        price  != null ? parseFloat(price)  : 0,
        weight != null ? parseFloat(weight) : null,
        n(description), n(thumbnail), n(image), n(category),
        stock  != null ? parseInt(stock)    : 0,
      ]
    );

    const product = await queryOne('SELECT * FROM products WHERE id = ?', [result.insertId]);
    logger.info('products.create', `Producto creado ID=${result.insertId}`);
    return res.status(201).json(product);
  } catch (err) {
    logger.error('products.create', err.message, err.stack);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT /api/products/:id
async function update(req, res) {
  try {
    const product = await queryOne('SELECT id FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    const { name, price, weight, description, thumbnail, image, category, stock } = req.body;
    logger.info('products.update', `Editando producto ID=${req.params.id}`, { name, price, stock });

    // n() convierte undefined/'' → null para que COALESCE lo ignore y mantenga el valor existente
    await run(
      `UPDATE products SET
        name        = COALESCE(?, name),
        price       = COALESCE(?, price),
        weight      = COALESCE(?, weight),
        description = COALESCE(?, description),
        thumbnail   = COALESCE(?, thumbnail),
        image       = COALESCE(?, image),
        category    = COALESCE(?, category),
        stock       = COALESCE(?, stock)
       WHERE id = ?`,
      [
        n(name),
        price  !== undefined && price  !== '' ? parseFloat(price)  : null,
        weight !== undefined && weight !== '' ? parseFloat(weight) : null,
        n(description),
        n(thumbnail),
        n(image),
        n(category),
        stock  !== undefined && stock  !== '' ? parseInt(stock)    : null,
        req.params.id,
      ]
    );

    const updated = await queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    logger.info('products.update', `Producto ID=${req.params.id} actualizado`);
    return res.json(updated);
  } catch (err) {
    logger.error('products.update', err.message, err.stack);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// DELETE /api/products/:id
async function remove(req, res) {
  try {
    const product = await queryOne('SELECT id FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    await run('DELETE FROM products WHERE id = ?', [req.params.id]);
    logger.info('products.remove', `Producto ID=${req.params.id} eliminado`);
    return res.json({ message: 'Producto eliminado correctamente' });
  } catch (err) {
    logger.error('products.remove', err.message, err.stack);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /api/products/stock-alerts  (usado en Reportes.jsx)
async function stockAlerts(req, res) {
  try {
    const low = await query('SELECT id, sku, name, stock FROM products WHERE stock <= 5 ORDER BY stock ASC');
    const failed = await query(
      `SELECT product_name, COUNT(*) AS attempt_count, SUM(requested) AS total_requested
       FROM stock_log GROUP BY product_name ORDER BY attempt_count DESC LIMIT 20`
    );
    return res.json({ low_stock: low, failed_attempts: failed });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno' });
  }
}

// POST /api/products/cache/invalidate  — forzar recarga de la API externa
async function invalidateCache(req, res) {
  _cache.data = null;
  _cache.ts   = 0;
  logger.info('products.cache', 'Caché invalidado manualmente');
  return res.json({ message: 'Caché invalidado. Próxima petición recargará desde Gesyco.' });
}

module.exports = { getAll, getOne, create, update, remove, stockAlerts, invalidateCache };