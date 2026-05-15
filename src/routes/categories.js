// src/routes/categories.js
const router = require('express').Router();
const ctrl = require('../controllers/categories.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/categories  — público con token
router.get('/', requireAuth, ctrl.getAll);

// GET /api/categories/:id
router.get('/:id', requireAuth, ctrl.getOne);

// POST /api/categories  — solo admin
router.post('/', requireAuth, requireAdmin, ctrl.create);

// PUT /api/categories/:id  — solo admin
router.put('/:id', requireAuth, requireAdmin, ctrl.update);

// DELETE /api/categories/:id  — solo admin
router.delete('/:id', requireAuth, requireAdmin, ctrl.remove);

module.exports = router;
