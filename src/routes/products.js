const router = require('express').Router();
const ctrl = require('../controllers/products.controller');
const { requireAuth, requireAdmin, requireAdminOrSale } = require('../middleware/auth');
const { productRules } = require('../validators/product.validators');

// Rutas específicas ANTES de /:id para que no sean capturadas por el parámetro
router.get('/stock-alerts',       requireAuth, requireAdminOrSale, ctrl.stockAlerts);
router.post('/cache/invalidate',  requireAuth, requireAdmin,       ctrl.invalidateCache);

// CRUD productos
router.get('/',       requireAuth,               ctrl.getAll);
router.get('/:id',    requireAuth,               ctrl.getOne);
router.post('/',      requireAuth, requireAdmin, productRules, ctrl.create);
router.put('/:id',    requireAuth, requireAdmin, productRules, ctrl.update);
router.delete('/:id', requireAuth, requireAdmin,               ctrl.remove);

module.exports = router;
