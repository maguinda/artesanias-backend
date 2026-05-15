// src/controllers/categories.controller.js
const logger = require('../utils/logger');
const { query, queryOne, run } = require('../models/db');

async function getAll(req, res) {
  try {
    const categories = await query('SELECT * FROM categories ORDER BY name ASC');
    return res.json(categories);
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getOne(req, res) {
  try {
    const cat = await queryOne('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!cat) return res.status(404).json({ error: 'Categoría no encontrada' });

    const products = await query(
      `SELECT p.* FROM products p
       JOIN product_categories pc ON p.id = pc.product_id
       WHERE pc.category_id = ?`,
      [req.params.id]
    );
    return res.json({ ...cat, products });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function create(req, res) {
  try {
    const { name, description, thumbnail } = req.body;
    if (!name?.trim()) return res.status(422).json({ error: 'El nombre es requerido' });

    const result = await run(
      'INSERT INTO categories (name, description, thumbnail) VALUES (?, ?, ?)',
      [name.trim(), description || null, thumbnail || null]
    );
    return res.status(201).json(await queryOne('SELECT * FROM categories WHERE id = ?', [result.insertId]));
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function update(req, res) {
  try {
    const cat = await queryOne('SELECT id FROM categories WHERE id = ?', [req.params.id]);
    if (!cat) return res.status(404).json({ error: 'Categoría no encontrada' });

    const { name, description, thumbnail } = req.body;
    await run(
      `UPDATE categories SET
        name        = COALESCE(?, name),
        description = COALESCE(?, description),
        thumbnail   = COALESCE(?, thumbnail)
       WHERE id = ?`,
      [name, description, thumbnail, req.params.id]
    );
    return res.json(await queryOne('SELECT * FROM categories WHERE id = ?', [req.params.id]));
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function remove(req, res) {
  try {
    const cat = await queryOne('SELECT id FROM categories WHERE id = ?', [req.params.id]);
    if (!cat) return res.status(404).json({ error: 'Categoría no encontrada' });
    await run('DELETE FROM categories WHERE id = ?', [req.params.id]);
    return res.json({ message: 'Categoría eliminada correctamente' });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { getAll, getOne, create, update, remove };
