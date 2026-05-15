const router = require('express').Router();
const ctrl = require('../controllers/orders.controller');
const { requireAuth, requireAdmin, requireAdminOrSale } = require('../middleware/auth');
const { orderRules } = require('../validators/order.validators');

router.post('/',               requireAuth,               orderRules, ctrl.create);
router.get('/',                requireAuth,               ctrl.getAll);
router.get('/:id',             requireAuth,               ctrl.getOne);
router.patch('/:id/status',    requireAuth, ctrl.updateStatus);
router.delete('/:id',          requireAuth,               ctrl.cancel);
router.patch('/:id/payment',   requireAuth,               ctrl.savePaymentDetails);

module.exports = router;
