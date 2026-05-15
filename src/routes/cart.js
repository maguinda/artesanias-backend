const router = require('express').Router();
const ctrl = require('../controllers/cart.controller');
const { requireAuth } = require('../middleware/auth');
const { cartItemRules } = require('../validators/order.validators');

router.get('/',         requireAuth,              ctrl.getCart);
router.post('/',        requireAuth, cartItemRules, ctrl.addItem);
router.put('/:itemId',  requireAuth,              ctrl.updateItem);
router.delete('/',      requireAuth,              ctrl.clearCart);
router.delete('/:itemId', requireAuth,            ctrl.removeItem);

module.exports = router;
