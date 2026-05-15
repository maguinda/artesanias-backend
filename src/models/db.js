// src/models/db.js
// Pool de conexiones MySQL usando mysql2/promise
const mysql = require('mysql2/promise');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host:              process.env.DB_HOST     || 'localhost',
      port:              parseInt(process.env.DB_PORT || '3306'),
      user:              process.env.DB_USER     || 'root',
      password:          process.env.DB_PASSWORD || '',
      database:          process.env.DB_NAME     || 'artesanias_colombianas',
      waitForConnections: true,
      connectionLimit:   10,
      queueLimit:        0,
      timezone:          'Z',           // fechas en UTC
      decimalNumbers:    true,
    });
  }
  return pool;
}

/**
 * Ejecuta una query y devuelve las filas.
 * @param {string} sql
 * @param {any[]}  params
 */
async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

/**
 * Ejecuta una query de escritura y devuelve el ResultSetHeader
 * (contiene insertId, affectedRows, etc.)
 */
async function run(sql, params = []) {
  const [result] = await getPool().execute(sql, params);
  return result;
}

/**
 * Devuelve la primera fila o null si no hay resultados.
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/**
 * Inicia una transacción y ejecuta la función callback(conn).
 * Hace rollback automático si hay error.
 */
async function transaction(callback) {
  const conn = await getPool().getConnection();
  await conn.beginTransaction();
  try {
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { getPool, query, run, queryOne, transaction };
