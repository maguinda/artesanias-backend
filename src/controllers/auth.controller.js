// src/controllers/auth.controller.js
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const axios  = require('axios');
const logger = require('../utils/logger');
const { query, queryOne, run } = require('../models/db');
const { JWT_SECRET, JWT_EXPIRES } = require('../middleware/auth');

const EXTERNAL_API = process.env.EXTERNAL_API_BASE || 'https://mdiapiqa.gesyco.co/api/v1';
const COMPANY_ID   = process.env.COMPANY_ID || '2';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

function makeToken(customer) {
  return jwt.sign(
    { id: customer.id, email: customer.email, name: customer.full_name, role: customer.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function safe(customer) {
  const { password, ...rest } = customer;
  return rest;
}

// POST /api/auth/register
async function register(req, res) {
  try {
    const { full_name, email, password, phone, cedula, country } = req.body;

    const existing = await queryOne('SELECT id FROM customers WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    }

    const result = await run(
      `INSERT INTO customers (email, password, full_name, phone, cedula, country)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, hashPassword(password), full_name, phone || null, cedula || null, country || 'Colombia']
    );

    const customer = await queryOne('SELECT * FROM customers WHERE id = ?', [result.insertId]);
    return res.status(201).json({ token: makeToken(customer), user: safe(customer) });
  } catch (err) {
    logger.error('[register]', err.message, err.stack);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // 1. BD local
    const customer = await queryOne('SELECT * FROM customers WHERE email = ?', [email]);
    if (customer) {
      if (customer.password !== hashPassword(password)) {
        return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
      }
      return res.json({ token: makeToken(customer), user: safe(customer) });
    }

    // 2. Fallback API externa Gesyco
    try {
      const { data } = await axios.get(
        `${EXTERNAL_API}/system/customers/getForMDILoginCustomer`,
        { params: { company_id: COMPANY_ID, email, password }, timeout: 8000 }
      );
      const ext = Object.values(data)[3];
      if (!ext) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });

      const result = await run(
        `INSERT INTO customers (email, password, full_name, country)
         VALUES (?, ?, ?, 'Colombia')
         ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`,
        [email, hashPassword(password), ext.name || email]
      );

      const newCustomer = await queryOne('SELECT * FROM customers WHERE email = ?', [email]);
      return res.json({ token: makeToken(newCustomer), user: safe(newCustomer) });
    } catch {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }
  } catch (err) {
    logger.error('[login]', err.message, err.stack);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /api/auth/me
async function me(req, res) {
  try {
    const customer = await queryOne(
      'SELECT id, email, full_name, phone, cedula, billing_address, default_shipping_address, barrio, city, country, role, avatar, created_at FROM customers WHERE id = ?',
      [req.user.id]
    );
    if (!customer) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json(customer);
  } catch (err) {
    logger.error('[me]', err.message, err.stack);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// n() convierte undefined/''/null → null para mysql2
const n = (v) => (v === undefined || v === '') ? null : v;

// PUT /api/auth/me
async function updateMe(req, res) {
  try {
    const { full_name, phone, cedula, billing_address, default_shipping_address, barrio, city, country } = req.body;
    logger.info('[updateMe]', `Actualizando perfil ID=${req.user.id}`);
    const { avatar } = req.body;
    await run(
      `UPDATE customers SET
        full_name                = COALESCE(?, full_name),
        phone                    = COALESCE(?, phone),
        cedula                   = COALESCE(?, cedula),
        billing_address          = COALESCE(?, billing_address),
        default_shipping_address = COALESCE(?, default_shipping_address),
        barrio                   = COALESCE(?, barrio),
        city                     = COALESCE(?, city),
        country                  = COALESCE(?, country),
        avatar                   = COALESCE(?, avatar)
       WHERE id = ?`,
      [n(full_name), n(phone), n(cedula), n(billing_address), n(default_shipping_address), n(barrio), n(city), n(country), n(avatar), req.user.id]
    );
    const updated = await queryOne(
      'SELECT id, email, full_name, phone, cedula, billing_address, default_shipping_address, barrio, city, country, role, avatar FROM customers WHERE id = ?',
      [req.user.id]
    );
    return res.json(updated);
  } catch (err) {
    logger.error('[updateMe]', err.message, err.stack);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { register, login, me, updateMe };
