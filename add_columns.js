// backend/add_columns.js
// Alternativa al script SQL — ejecutar con: node add_columns.js
// Agrega las columnas de pago a la BD existente sin borrar datos

require('dotenv').config()
const { query, getPool } = require('./src/models/db')

async function main() {
  console.log('🔄  Agregando columnas de pago a la BD...\n')

  const alterations = [
    // orders - CyberSource
    ["ALTER TABLE orders ADD COLUMN cs_transaction_id    VARCHAR(100)      AFTER vendedor_id",  "cs_transaction_id"],
    ["ALTER TABLE orders ADD COLUMN cs_approval_code     VARCHAR(50)       AFTER cs_transaction_id", "cs_approval_code"],
    ["ALTER TABLE orders ADD COLUMN cs_reconciliation_id VARCHAR(100)      AFTER cs_approval_code", "cs_reconciliation_id"],
    ["ALTER TABLE orders ADD COLUMN cs_reference_code    VARCHAR(100)      AFTER cs_reconciliation_id", "cs_reference_code"],
    ["ALTER TABLE orders ADD COLUMN cs_response_code     VARCHAR(20)       AFTER cs_reference_code", "cs_response_code"],
    ["ALTER TABLE orders ADD COLUMN cs_network_tx_id     VARCHAR(100)      AFTER cs_response_code", "cs_network_tx_id"],
    ["ALTER TABLE orders ADD COLUMN cs_status            VARCHAR(50)       AFTER cs_network_tx_id", "cs_status"],
    ["ALTER TABLE orders ADD COLUMN cs_submit_time       VARCHAR(50)       AFTER cs_status", "cs_submit_time"],
    ["ALTER TABLE orders ADD COLUMN cs_simulated         TINYINT(1) DEFAULT 0 AFTER cs_submit_time", "cs_simulated"],
    ["ALTER TABLE orders ADD COLUMN paid_at              DATETIME          AFTER cs_simulated", "paid_at"],
    // orders - venta manual
    ["ALTER TABLE orders ADD COLUMN nombre_cliente   VARCHAR(200) AFTER notes", "nombre_cliente"],
    ["ALTER TABLE orders ADD COLUMN cedula_cliente   VARCHAR(30)  AFTER nombre_cliente", "cedula_cliente"],
    ["ALTER TABLE orders ADD COLUMN celular_cliente  VARCHAR(20)  AFTER cedula_cliente", "celular_cliente"],
    ["ALTER TABLE orders ADD COLUMN vendedor_id      INT          AFTER celular_cliente", "vendedor_id"],
    // customers - Google OAuth
    ["ALTER TABLE customers ADD COLUMN google_id VARCHAR(200) AFTER country", "google_id"],
    ["ALTER TABLE customers ADD COLUMN avatar    VARCHAR(500) AFTER google_id", "avatar"],
    // customers - role enum update
    ["ALTER TABLE customers MODIFY COLUMN role ENUM('customer','admin','sale') DEFAULT 'customer'", "role enum"],
    // stock_log table
    [`CREATE TABLE IF NOT EXISTS stock_log (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      product_id   INT NOT NULL,
      product_name VARCHAR(200),
      requested    INT NOT NULL,
      available    INT NOT NULL,
      customer_id  INT,
      logged_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`, "stock_log table"],
  ]

  let ok = 0, skipped = 0

  for (const [sql, name] of alterations) {
    try {
      await query(sql)
      console.log(`  ✅  ${name}`)
      ok++
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_TABLE_EXISTS_ERROR' ||
          e.message.includes('Duplicate column') || e.message.includes('already exists')) {
        console.log(`  ⏭️   ${name} (ya existe)`)
        skipped++
      } else {
        console.error(`  ❌  ${name}: ${e.message}`)
      }
    }
  }

  console.log(`\n✅  Listo: ${ok} agregadas, ${skipped} ya existían.`)
  await getPool().end()
}

main().catch(err => {
  console.error('Error fatal:', err.message)
  process.exit(1)
})
