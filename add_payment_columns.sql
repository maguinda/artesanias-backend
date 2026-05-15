-- ============================================================
-- Script: add_payment_columns.sql
-- Agrega las columnas de pago CyberSource a la tabla orders
-- Ejecutar en MySQL Workbench o terminal:
--   mysql -u root -p artesanias_colombianas < add_payment_columns.sql
-- ============================================================

USE artesanias_colombianas;

-- Columnas de CyberSource en orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cs_transaction_id    VARCHAR(100)  AFTER vendedor_id;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cs_approval_code     VARCHAR(50)   AFTER cs_transaction_id;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cs_reconciliation_id VARCHAR(100)  AFTER cs_approval_code;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cs_reference_code    VARCHAR(100)  AFTER cs_reconciliation_id;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cs_response_code     VARCHAR(20)   AFTER cs_reference_code;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cs_network_tx_id     VARCHAR(100)  AFTER cs_response_code;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cs_status            VARCHAR(50)   AFTER cs_network_tx_id;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cs_submit_time       VARCHAR(50)   AFTER cs_status;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cs_simulated         TINYINT(1) DEFAULT 0 AFTER cs_submit_time;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at              DATETIME      AFTER cs_simulated;

-- Columnas adicionales en orders (si no existen)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS nombre_cliente   VARCHAR(200) AFTER notes;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cedula_cliente   VARCHAR(30)  AFTER nombre_cliente;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS celular_cliente  VARCHAR(20)  AFTER cedula_cliente;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vendedor_id      INT          AFTER celular_cliente;

-- Columna google_id/avatar en customers (si no existe)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS google_id VARCHAR(200) AFTER country;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar    VARCHAR(500) AFTER google_id;

-- Columna product_name en order_details (si no existe)  
-- (Ya no la usamos - usamos JOIN, pero por si acaso)

SELECT 'Columnas agregadas correctamente' AS resultado;

-- Verificar columnas de orders
DESCRIBE orders;
