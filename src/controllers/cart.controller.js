// src/controllers/cart.controller.js
const logger = require('../utils/logger');
const { query, queryOne, run } = require('../models/db');

const calcTotal = (items) => items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0);

async function getCart(req, res) {
  try {
    const items = await query(
      'SELECT * FROM cart_items WHERE customer_id = ? ORDER BY added_at DESC',
      [req.user.id]
    );
    return res.json({ items, total: calcTotal(items) });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function addItem(req, res) {
  try {
    const { product_id, quantity, price, product_name, product_image, sku } = req.body;

    // UPSERT: si existe suma cantidad, si no inserta
    await run(
      `INSERT INTO cart_items (customer_id, product_id, product_name, product_image, price, quantity, sku)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [req.user.id, product_id, product_name, product_image || null,
       parseFloat(price), parseInt(quantity), sku || null]
    );

    const items = await query('SELECT * FROM cart_items WHERE customer_id = ?', [req.user.id]);
    return res.status(201).json({ items, total: calcTotal(items) });
  } catch (err) {
    logger.error('[addItem]', err.message, err.stack);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function updateItem(req, res) {
  try {
    const { quantity } = req.body;
    if (!quantity || parseInt(quantity) < 1)
      return res.status(422).json({ error: 'La cantidad debe ser al menos 1' });

    const item = await queryOne(
      'SELECT id FROM cart_items WHERE id = ? AND customer_id = ?',
      [req.params.itemId, req.user.id]
    );
    if (!item) return res.status(404).json({ error: 'Item no encontrado en el carrito' });

    await run('UPDATE cart_items SET quantity = ? WHERE id = ?', [parseInt(quantity), req.params.itemId]);

    const items = await query('SELECT * FROM cart_items WHERE customer_id = ?', [req.user.id]);
    return res.json({ items, total: calcTotal(items) });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function removeItem(req, res) {
  try {
    const item = await queryOne(
      'SELECT id FROM cart_items WHERE id = ? AND customer_id = ?',
      [req.params.itemId, req.user.id]
    );
    if (!item) return res.status(404).json({ error: 'Item no encontrado en el carrito' });

    await run('DELETE FROM cart_items WHERE id = ?', [req.params.itemId]);

    const items = await query('SELECT * FROM cart_items WHERE customer_id = ?', [req.user.id]);
    return res.json({ items, total: calcTotal(items) });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function clearCart(req, res) {
  try {
    await run('DELETE FROM cart_items WHERE customer_id = ?', [req.user.id]);
    return res.json({ message: 'Carrito vaciado', items: [], total: 0 });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };
