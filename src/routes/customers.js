// src/routes/customers.js
const router = require('express').Router();
const ctrl = require('../controllers/customers.controller');
const { requireAuth, requireAdmin, requireAdminOrSale } = require('../middleware/auth');

// Todas las rutas de clientes son solo para admin
// GET /api/customers
router.get('/', requireAuth, requireAdminOrSale, ctrl.getAll);

// GET /api/customers/:id
router.get('/:id', requireAuth, requireAdminOrSale, ctrl.getOne);

// PUT /api/customers/:id
router.put('/:id', requireAuth, requireAdminOrSale, ctrl.update);

// DELETE /api/customers/:id
router.delete('/:id', requireAuth, requireAdmin, ctrl.remove);

module.exports = router;

// POST /api/customers  — crear cliente desde admin
router.post('/', requireAuth, requireAdminOrSale, async (req, res) => {
  const { query, queryOne, run } = require('../models/db')
  const crypto = require('crypto')
  const { JWT_SECRET } = require('../middleware/auth')

  try {
    const { full_name, email, phone, cedula, city, barrio, billing_address, role, password, avatar } = req.body
    if (!full_name || !email) return res.status(422).json({ error: 'Nombre y correo son obligatorios' })

    const existing = await queryOne('SELECT id FROM customers WHERE email = ?', [email])
    if (existing) return res.status(409).json({ error: 'Ya existe un usuario con ese correo' })

    const hashedPw = crypto.createHash('sha256')
      .update((password || 'Temporal123') + JWT_SECRET).digest('hex')

    const result = await run(
      `INSERT INTO customers (email, password, full_name, phone, cedula, city, barrio, billing_address, role, avatar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPw, full_name, phone||null, cedula||null, city||null, barrio||null, billing_address||null, role||'customer', avatar||null]
    )
    const customer = await queryOne(
      'SELECT id, email, full_name, phone, cedula, city, role, avatar FROM customers WHERE id = ?',
      [result.insertId]
    )
    return res.status(201).json(customer)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})
