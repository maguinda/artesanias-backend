// src/controllers/customers.controller.js
const { query, queryOne, run } = require('../models/db');
const logger = require('../utils/logger');

// Convierte undefined/'' → null para que mysql2 no falle
const n = (v) => (v === undefined || v === '') ? null : v;

async function getAll(req, res) {
  try {
    const customers = await query(
      'SELECT id, email, full_name, phone, cedula, city, country, role, avatar, created_at FROM customers ORDER BY created_at DESC'
    );
    return res.json(customers);
  } catch (err) {
    logger.error('customers.getAll', err.message, err.stack);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getOne(req, res) {
  try {
    const customer = await queryOne(
      'SELECT id, email, full_name, phone, cedula, billing_address, default_shipping_address, barrio, city, country, role, created_at FROM customers WHERE id = ?',
      [req.params.id]
    );
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    const orders = await query(
      'SELECT id, amount, order_status, order_date FROM orders WHERE customer_id = ? ORDER BY order_date DESC',
      [req.params.id]
    );
    return res.json({ ...customer, orders });
  } catch (err) {
    logger.error('customers.getOne', err.message, err.stack);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function update(req, res) {
  try {
    const { full_name, phone, cedula, city, country, role } = req.body;
    logger.info('customers.update', `Editando cliente ID=${req.params.id}`, { full_name, phone, city, role });

    const validRoles = ['customer', 'admin', 'sale'];
    const customer = await queryOne('SELECT id FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    if (role && !validRoles.includes(role)) {
      return res.status(422).json({ error: `Rol inválido. Use: ${validRoles.join(' o ')}` });
    }

    // n() garantiza null en lugar de undefined — mysql2 rechaza undefined
    await run(
      `UPDATE customers SET
        full_name = COALESCE(?, full_name),
        phone     = COALESCE(?, phone),
        cedula    = COALESCE(?, cedula),
        city      = COALESCE(?, city),
        country   = COALESCE(?, country),
        role      = COALESCE(?, role)
       WHERE id = ?`,
      [n(full_name), n(phone), n(cedula), n(city), n(country), n(role), req.params.id]
    );

    const updated = await queryOne(
      'SELECT id, email, full_name, phone, cedula, city, country, role FROM customers WHERE id = ?',
      [req.params.id]
    );
    logger.info('customers.update', `Cliente ID=${req.params.id} actualizado`);
    return res.json(updated);
  } catch (err) {
    logger.error('customers.update', err.message, err.stack);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function remove(req, res) {
  try {
    const customer = await queryOne('SELECT id FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });
    await run('DELETE FROM customers WHERE id = ?', [req.params.id]);
    logger.info('customers.remove', `Cliente ID=${req.params.id} eliminado`);
    return res.json({ message: 'Cliente eliminado correctamente' });
  } catch (err) {
    logger.error('customers.remove', err.message, err.stack);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { getAll, getOne, update, remove };
