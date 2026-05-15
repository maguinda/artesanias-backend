// src/models/migrate.js
// Ejecutar con:  node src/models/migrate.js
require('dotenv').config();
const { query, getPool } = require('./db');
const crypto = require('crypto');

// ── Tablas ────────────────────────────────────────────────────────────────────
async function migrate() {
  console.log('🔄  Ejecutando migración MySQL...');

  await query(`
    CREATE TABLE IF NOT EXISTS categories (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(120) NOT NULL,
      description TEXT,
      thumbnail   VARCHAR(500),
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      sku         VARCHAR(50)  NOT NULL UNIQUE,
      name        VARCHAR(200) NOT NULL,
      price       DECIMAL(12,2) NOT NULL DEFAULT 0,
      weight      DECIMAL(8,3),
      description TEXT,
      thumbnail   VARCHAR(500),
      image       VARCHAR(500),
      category    VARCHAR(100),
      stock       INT NOT NULL DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      product_id  INT NOT NULL,
      category_id INT NOT NULL,
      UNIQUE KEY uq_prod_cat (product_id, category_id),
      FOREIGN KEY (product_id)  REFERENCES products(id)   ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS options (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      option_name VARCHAR(100) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS product_options (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      option_id  INT NOT NULL,
      UNIQUE KEY uq_prod_opt (product_id, option_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (option_id)  REFERENCES options(id)  ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS customers (
      id                       INT AUTO_INCREMENT PRIMARY KEY,
      email                    VARCHAR(200) NOT NULL UNIQUE,
      password                 VARCHAR(64),
      full_name                VARCHAR(200) NOT NULL,
      cedula                   VARCHAR(20),
      phone                    VARCHAR(20),
      billing_address          VARCHAR(300),
      default_shipping_address VARCHAR(300),
      barrio                   VARCHAR(100),
      city                     VARCHAR(100),
      country                  VARCHAR(80)  DEFAULT 'Colombia',
      google_id                VARCHAR(200),
      avatar                   VARCHAR(500),
      role                     ENUM('customer','admin','sale') DEFAULT 'customer',
      google_id                VARCHAR(200),
      avatar                   VARCHAR(500),
      created_at               DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS orders (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      customer_id      INT NOT NULL,
      amount           DECIMAL(14,2) NOT NULL DEFAULT 0,
      shipping_address VARCHAR(300),
      barrio           VARCHAR(100),
      city             VARCHAR(100),
      order_email      VARCHAR(200),
      order_date       DATETIME DEFAULT CURRENT_TIMESTAMP,
      order_status     ENUM('pendiente','pagado','enviado','entregado','cancelado') DEFAULT 'pendiente',
      payment_method   VARCHAR(50),
      shipping_cost    DECIMAL(10,2) DEFAULT 0,
      shipping_company VARCHAR(100),
      notes            TEXT,
      nombre_cliente   VARCHAR(200),
      cedula_cliente   VARCHAR(30),
      celular_cliente  VARCHAR(20),
      vendedor_id          INT,
      cs_transaction_id    VARCHAR(100),
      cs_approval_code     VARCHAR(50),
      cs_reconciliation_id VARCHAR(100),
      cs_reference_code    VARCHAR(100),
      cs_response_code     VARCHAR(20),
      cs_network_tx_id     VARCHAR(100),
      cs_status            VARCHAR(50),
      cs_submit_time       VARCHAR(50),
      cs_simulated         TINYINT(1) DEFAULT 0,
      paid_at              DATETIME,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (vendedor_id) REFERENCES customers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS order_details (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      order_id   INT NOT NULL,
      product_id INT NOT NULL,
      price      DECIMAL(12,2) NOT NULL,
      sku        VARCHAR(50),
      quantity     INT NOT NULL DEFAULT 1,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      customer_id   INT NOT NULL,
      product_id    INT NOT NULL,
      product_name  VARCHAR(200),
      product_image VARCHAR(500),
      price         DECIMAL(12,2) NOT NULL,
      quantity      INT NOT NULL DEFAULT 1,
      sku           VARCHAR(50),
      added_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_cart (customer_id, product_id),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);



  // ── ALTER TABLE: columnas nuevas en orders ───────────────────────────────
  const orderAlters = [
    // Venta manual
    "ALTER TABLE orders ADD COLUMN nombre_cliente   VARCHAR(200) AFTER notes",
    "ALTER TABLE orders ADD COLUMN cedula_cliente   VARCHAR(30)  AFTER nombre_cliente",
    "ALTER TABLE orders ADD COLUMN celular_cliente  VARCHAR(20)  AFTER cedula_cliente",
    "ALTER TABLE orders ADD COLUMN vendedor_id      INT          AFTER celular_cliente",
    // CyberSource
    "ALTER TABLE orders ADD COLUMN cs_transaction_id    VARCHAR(100)      AFTER vendedor_id",
    "ALTER TABLE orders ADD COLUMN cs_approval_code     VARCHAR(50)       AFTER cs_transaction_id",
    "ALTER TABLE orders ADD COLUMN cs_reconciliation_id VARCHAR(100)      AFTER cs_approval_code",
    "ALTER TABLE orders ADD COLUMN cs_reference_code    VARCHAR(100)      AFTER cs_reconciliation_id",
    "ALTER TABLE orders ADD COLUMN cs_response_code     VARCHAR(20)       AFTER cs_reference_code",
    "ALTER TABLE orders ADD COLUMN cs_network_tx_id     VARCHAR(100)      AFTER cs_response_code",
    "ALTER TABLE orders ADD COLUMN cs_status            VARCHAR(50)       AFTER cs_network_tx_id",
    "ALTER TABLE orders ADD COLUMN cs_submit_time       VARCHAR(50)       AFTER cs_status",
    "ALTER TABLE orders ADD COLUMN cs_simulated         TINYINT(1) DEFAULT 0 AFTER cs_submit_time",
    "ALTER TABLE orders ADD COLUMN paid_at              DATETIME          AFTER cs_simulated",
  ];
  for (const sql of orderAlters) { try { await query(sql); } catch(e) { /* ya existe */ } }

  // Agregar columnas google_id y avatar si no existen (para BDs ya migradas)
  try {
    await query("ALTER TABLE customers ADD COLUMN google_id VARCHAR(200) AFTER country");
    console.log('  + Columna google_id agregada');
  } catch (e) { /* ya existe */ }

  try {
    await query("ALTER TABLE customers ADD COLUMN avatar VARCHAR(500) AFTER google_id");
    console.log('  + Columna avatar agregada');
  } catch (e) { /* ya existe */ }

  // Actualizar ENUM de role para incluir 'sale'
  try {
    await query("ALTER TABLE customers MODIFY COLUMN role ENUM('customer','admin','sale') DEFAULT 'customer'");
    console.log('  + Role ENUM actualizado con sale');
  } catch (e) { /* ya está */ }


  await query(`
    CREATE TABLE IF NOT EXISTS stock_log (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      product_id   INT NOT NULL,
      product_name VARCHAR(200),
      requested    INT NOT NULL,
      available    INT NOT NULL,
      customer_id  INT,
      logged_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log('✅  Migración completada. Tablas creadas:');
  console.log('    categories, products, product_categories, options,');
  console.log('    product_options, customers, orders, order_details, cart_items');
}

// ── Seed: usuarios base ───────────────────────────────────────────────────────
async function seed() {
  const JWT_SECRET = process.env.JWT_SECRET || 'artesanias-colombianas-cambia-esto-en-produccion';

  function hash(pw) {
    return crypto.createHash('sha256').update(pw + JWT_SECRET).digest('hex');
  }

  await query(`
    INSERT INTO customers (email, password, full_name, role)
    VALUES (?, ?, 'Administrador', 'admin')
    ON DUPLICATE KEY UPDATE role = 'admin'
  `, ['admin@artesanias.com', hash('Admin123')]);

  await query(`
    INSERT INTO customers (email, password, full_name, role)
    VALUES (?, ?, 'Cliente Demo', 'customer')
    ON DUPLICATE KEY UPDATE id = id
  `, ['cliente@artesanias.com', hash('Cliente123')]);

  console.log('');
  console.log('🔑  Usuarios base:');
  console.log('    ADMIN    → admin@artesanias.com   / Admin123');
  await query(`
    INSERT INTO customers (email, password, full_name, role)
    VALUES (?, ?, 'Vendedor Demo', 'sale')
    ON DUPLICATE KEY UPDATE id = id
  `, ['vendedor@artesanias.com', hash('Vendedor123')]);

  console.log('    CUSTOMER → cliente@artesanias.com  / Cliente123');
  console.log('    SALE     → vendedor@artesanias.com / Vendedor123');
  console.log('');
  console.log('⚠️   Cambia estas contraseñas en producción.');
}

// ── Ejecutar todo y cerrar el pool AL FINAL ───────────────────────────────────
async function main() {
  try {
    await migrate();
    await seed();
  } catch (err) {
    console.error('❌  Error:', err.message);
    process.exit(1);
  } finally {
    // Solo se cierra aquí, cuando ya terminaron migrate Y seed
    await getPool().end();
    console.log('🏁  Conexión cerrada.');
  }
}

main();
