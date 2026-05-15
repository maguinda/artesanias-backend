// src/routes/google.js
// Endpoint para login/registro con Google OAuth
// Recibe el credential (id_token) del botón de Google One Tap o GSI
const router  = require('express').Router();
const https   = require('https');
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const { queryOne, run } = require('../models/db');
const { JWT_SECRET, JWT_EXPIRES } = require('../middleware/auth');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

/**
 * Verifica el id_token de Google consultando el endpoint público de Google.
 * No requiere dependencias extra — usa el módulo https nativo de Node.
 */
function verifyGoogleToken(credential) {
  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const payload = JSON.parse(data);
          if (payload.error) return reject(new Error(payload.error_description || 'Token inválido'));
          // Verificar que el token fue emitido para nuestra app
          if (GOOGLE_CLIENT_ID && payload.aud !== GOOGLE_CLIENT_ID) {
            return reject(new Error('Token no pertenece a esta aplicación'));
          }
          resolve(payload);
        } catch {
          reject(new Error('Respuesta inválida de Google'));
        }
      });
    }).on('error', reject);
  });
}

// POST /api/auth/google
// Body: { credential: "<google_id_token>" }
router.post('/', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(422).json({ error: 'Se requiere el token de Google' });
    }

    // 1. Verificar token con Google
    const payload = await verifyGoogleToken(credential);

    const {
      sub: google_id,
      email,
      name: full_name,
      picture: avatar,
    } = payload;

    if (!email) {
      return res.status(422).json({ error: 'No se pudo obtener el email de Google' });
    }

    // 2. Buscar cliente por google_id o email
    let customer = await queryOne(
      'SELECT * FROM customers WHERE google_id = ? OR email = ?',
      [google_id, email]
    );

    if (customer) {
      // Actualizar google_id y avatar si no los tenía
      if (!customer.google_id) {
        await run(
          'UPDATE customers SET google_id = ?, avatar = ? WHERE id = ?',
          [google_id, avatar || null, customer.id]
        );
        customer.google_id = google_id;
        customer.avatar    = avatar;
      }
    } else {
      // 3. Crear cliente nuevo (sin contraseña — solo Google)
      const result = await run(
        `INSERT INTO customers (email, password, full_name, google_id, avatar, country)
         VALUES (?, '', ?, ?, ?, 'Colombia')`,
        [email, full_name || email, google_id, avatar || null]
      );
      customer = await queryOne('SELECT * FROM customers WHERE id = ?', [result.insertId]);
    }

    // 4. Emitir JWT propio
    const token = jwt.sign(
      { id: customer.id, email: customer.email, name: customer.full_name, role: customer.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    const { password, ...safe } = customer;
    return res.json({ token, user: safe });

  } catch (err) {
    console.error('[google-auth]', err.message);
    return res.status(401).json({ error: 'No se pudo autenticar con Google: ' + err.message });
  }
});

module.exports = router;
