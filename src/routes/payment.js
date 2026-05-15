// src/routes/payment.js
const router = require('express').Router();
const { processPayment } = require('../controllers/payment.controller');
const { requireAuth } = require('../middleware/auth');

// POST /api/payment
router.post('/', requireAuth, processPayment);

module.exports = router;
