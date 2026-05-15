const router = require('express').Router();
const ctrl = require('../controllers/products.controller');
const { requireAuth, requireAdmin, requireAdminOrSale } = require('../middleware/auth');
const { productRules, listProductsRules } = require('../validators/product.validators');

router.get('/',    requireAuth,               ctrl.getAll);
router.get('/:id', requireAuth,               ctrl.getOne);
router.post('/',   requireAuth, requireAdmin, productRules,    ctrl.create);
router.put('/:id', requireAuth, requireAdmin, productRules,    ctrl.update);
router.delete('/:id', requireAuth, requireAdmin,               ctrl.remove);

module.exports = router;

// GET /api/products/stock-alerts  — productos con bajo stock + intentos fallidos
router.get('/stock-alerts', requireAuth, requireAdminOrSale, async (req, res) => {
  const { query } = require('../models/db');
  try {
    const lowStock = await query(
      'SELECT id, sku, name, stock, category FROM products WHERE stock <= 5 ORDER BY stock ASC'
    );
    const failedAttempts = await query(
      `SELECT sl.product_id, sl.product_name, SUM(sl.requested) AS total_requested,
              COUNT(*) AS attempt_count, MAX(sl.available) AS last_available
       FROM stock_log sl
       GROUP BY sl.product_id, sl.product_name
       ORDER BY attempt_count DESC LIMIT 20`
    );
    return res.json({ low_stock: lowStock, failed_attempts: failedAttempts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
