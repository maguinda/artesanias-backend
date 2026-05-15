// src/controllers/orders.controller.js
const logger = require('../utils/logger');
const { query, queryOne, run, transaction } = require('../models/db');

// POST /api/orders
async function create(req, res) {
  try {
    const {
      items, shipping_address, barrio, city, order_email,
      payment_method, shipping_cost = 0, shipping_company, notes,
      nombre_cliente, cedula_cliente, celular_cliente,
    } = req.body;

    const amount = items.reduce((s, i) => s + parseFloat(i.price) * parseInt(i.quantity), 0)
                 + parseFloat(shipping_cost);

    // Si se especificó email de cliente, buscar si está registrado para vincular la orden
    let linkedCustomerId = req.user.id;
    if (order_email && order_email !== req.user.email) {
      const { queryOne: qOne } = require('../models/db');
      const registeredCustomer = await qOne(
        'SELECT id FROM customers WHERE email = ?', [order_email]
      );
      if (registeredCustomer) {
        linkedCustomerId = registeredCustomer.id;
        logger.info('orders.create', `Orden vinculada al cliente ID=${registeredCustomer.id} (${order_email})`);
      }
    }

    const orderId = await transaction(async (conn) => {
      // Crear orden — customer_id apunta al cliente real si se encontró por email
      const [orderRes] = await conn.execute(
        `INSERT INTO orders
           (customer_id, amount, shipping_address, barrio, city, order_email,
            payment_method, shipping_cost, shipping_company, notes,
            nombre_cliente, cedula_cliente, celular_cliente, vendedor_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [linkedCustomerId, amount, shipping_address, barrio || null, city,
         order_email || req.user.email, payment_method,
         parseFloat(shipping_cost), shipping_company || null, notes || null,
         nombre_cliente || null, cedula_cliente || null, celular_cliente || null,
         ['admin','sale'].includes(req.user.role) ? req.user.id : null]  // vendedor_id: solo para admin/sale
      );
      const oid = orderRes.insertId;

      // Verificar stock y actualizar
      for (const item of items) {
        const qty = parseInt(item.quantity);

        // Solo verificar stock para productos locales (tienen product_id numérico)
        if (item.product_id) {
          const [rows] = await conn.execute(
            'SELECT stock, name FROM products WHERE id = ?', [item.product_id]
          );
          const product = rows[0];
          if (product) {
            if (product.stock < qty) {
              // Registrar intento fallido en stock_log
              await conn.execute(
                'INSERT INTO stock_log (product_id, product_name, requested, available, customer_id) VALUES (?, ?, ?, ?, ?)',
                [item.product_id, product.name, qty, product.stock, req.user.id]
              );
              throw new Error(`Stock insuficiente para "${product.name}". Disponible: ${product.stock}`);
            }
            // Reducir stock
            await conn.execute(
              'UPDATE products SET stock = stock - ? WHERE id = ?',
              [qty, item.product_id]
            );
          }
        }

        await conn.execute(
          'INSERT INTO order_details (order_id, product_id, price, sku, quantity) VALUES (?, ?, ?, ?, ?)',
          [oid, item.product_id, parseFloat(item.price), item.sku || null, qty]
        );
      }

      // Vaciar carrito solo si la compra la hizo el propio cliente
      if (linkedCustomerId === req.user.id) {
        await conn.execute('DELETE FROM cart_items WHERE customer_id = ?', [req.user.id]);
      }

      return oid;
    });

    const order   = await queryOne(
      `SELECT o.*,
              COALESCE(o.nombre_cliente, c.full_name) AS nombre_cliente,
              COALESCE(o.cedula_cliente, c.cedula)    AS cedula_cliente,
              COALESCE(o.celular_cliente, c.phone)    AS celular_cliente,
              c.email AS customer_email,
              c.phone AS customer_phone
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`,
      [orderId]
    );
    const details = await query(
      `SELECT od.*, p.name AS product_name
       FROM order_details od
       LEFT JOIN products p ON od.product_id = p.id
       WHERE od.order_id = ?`,
      [orderId]
    );
    return res.status(201).json({ ...order, items: details });
  } catch (err) {
    logger.error('[orders.create]', err.message, err.stack);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /api/orders
async function getAll(req, res) {
  try {
    let orders;
    if (req.user.role === 'admin') {
      // Admin ve TODAS las órdenes
      orders = await query(
        `SELECT o.*,
                COALESCE(o.nombre_cliente, c.full_name) AS customer_name,
                c.email  AS customer_email,
                COALESCE(o.celular_cliente, c.phone)    AS customer_phone
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         ORDER BY o.order_date DESC`
      );
    } else if (req.user.role === 'sale') {
      // Sale ve las órdenes donde él fue el vendedor (por vendedor_id)
      orders = await query(
        `SELECT o.*,
                COALESCE(o.nombre_cliente, c.full_name) AS customer_name,
                c.email  AS customer_email,
                COALESCE(o.celular_cliente, c.phone)    AS customer_phone
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE o.vendedor_id = ?
         ORDER BY o.order_date DESC`,
        [req.user.id]
      );
    } else {
      // Customer solo ve sus propias órdenes
      orders = await query(
        'SELECT * FROM orders WHERE customer_id = ? ORDER BY order_date DESC',
        [req.user.id]
      );
    }
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /api/orders/:id
async function getOne(req, res) {
  try {
    const order = await queryOne(
      `SELECT o.*,
              COALESCE(o.nombre_cliente, c.full_name) AS nombre_cliente,
              COALESCE(o.cedula_cliente, c.cedula)    AS cedula_cliente,
              COALESCE(o.celular_cliente, c.phone)    AS celular_cliente,
              c.email AS customer_email,
              c.phone AS customer_phone
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`,
      [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    if (req.user.role !== 'admin' && order.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta orden' });
    }

    const details = await query(
      `SELECT od.*, p.name AS product_name
       FROM order_details od
       LEFT JOIN products p ON od.product_id = p.id
       WHERE od.order_id = ?`,
      [req.params.id]
    );
    return res.json({ ...order, items: details });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PATCH /api/orders/:id/status
async function updateStatus(req, res) {
  try {
    const valid = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];
    const { status } = req.body;
    if (!valid.includes(status)) {
      return res.status(422).json({ error: `Estado inválido. Use: ${valid.join(', ')}` });
    }
    const order = await queryOne(
      `SELECT o.*,
              COALESCE(o.nombre_cliente, c.full_name) AS nombre_cliente,
              COALESCE(o.cedula_cliente, c.cedula)    AS cedula_cliente,
              COALESCE(o.celular_cliente, c.phone)    AS celular_cliente,
              c.email AS customer_email,
              c.phone AS customer_phone
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`,
      [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    // Permisos por rol:
    // - Admin: puede cambiar cualquier orden
    // - Sale: solo sus ventas (vendedor_id)
    // - Customer: solo sus propias órdenes y solo a 'pagado' (después de pagar)
    if (req.user.role === 'sale' && order.vendedor_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo puedes cambiar el estado de tus propias ventas' });
    }
    if (req.user.role === 'customer') {
      if (order.customer_id !== req.user.id) {
        return res.status(403).json({ error: 'No tienes permiso para modificar esta orden' });
      }
      if (status !== 'pagado') {
        return res.status(403).json({ error: 'Los clientes solo pueden marcar órdenes como pagadas' });
      }
    }

    await run('UPDATE orders SET order_status = ? WHERE id = ?', [status, req.params.id]);
    return res.json(await queryOne(
      `SELECT o.*,
              COALESCE(o.nombre_cliente, c.full_name) AS nombre_cliente,
              COALESCE(o.cedula_cliente, c.cedula)    AS cedula_cliente,
              COALESCE(o.celular_cliente, c.phone)    AS celular_cliente,
              c.email AS customer_email,
              c.phone AS customer_phone
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`,
      [req.params.id]
    ));
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// DELETE /api/orders/:id — cancelar
async function cancel(req, res) {
  try {
    const order = await queryOne(
      `SELECT o.*,
              COALESCE(o.nombre_cliente, c.full_name) AS nombre_cliente,
              COALESCE(o.cedula_cliente, c.cedula)    AS cedula_cliente,
              COALESCE(o.celular_cliente, c.phone)    AS celular_cliente,
              c.email AS customer_email,
              c.phone AS customer_phone
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`,
      [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    if (req.user.role !== 'admin' && order.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para cancelar esta orden' });
    }
    if (order.order_status !== 'pendiente') {
      return res.status(409).json({ error: 'Solo se pueden cancelar órdenes pendientes' });
    }

    await run("UPDATE orders SET order_status = 'cancelado' WHERE id = ?", [req.params.id]);

    // Restaurar stock al cancelar
    const cancelDetails = await query('SELECT * FROM order_details WHERE order_id = ?', [req.params.id]);
    for (const detail of cancelDetails) {
      if (detail.product_id) {
        await run('UPDATE products SET stock = stock + ? WHERE id = ?', [detail.quantity, detail.product_id]);
      }
    }
    logger.info('orders.cancel', `Orden #${req.params.id} cancelada — stock restaurado`);
    return res.json({ message: 'Orden cancelada y stock restaurado' });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}


// PATCH /api/orders/:id/payment  — guardar detalles del pago en la orden
async function savePaymentDetails(req, res) {
  try {
    const { id } = req.params;
    const {
      cs_transaction_id, cs_approval_code, cs_reconciliation_id,
      cs_reference_code, cs_response_code, cs_network_tx_id,
      cs_status, cs_submit_time, cs_simulated,
    } = req.body;

    const order = await queryOne(
      `SELECT o.*,
              COALESCE(o.nombre_cliente, c.full_name) AS nombre_cliente,
              COALESCE(o.cedula_cliente, c.cedula)    AS cedula_cliente,
              COALESCE(o.celular_cliente, c.phone)    AS celular_cliente,
              c.email AS customer_email,
              c.phone AS customer_phone
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`,
      [id]
    );
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    // Verificar que el usuario puede actualizar esta orden
    if (req.user.role === 'customer' && order.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Sin permiso' });
    }

    const n = (v) => (v === undefined || v === '') ? null : v;

    await run(
      `UPDATE orders SET
        cs_transaction_id    = COALESCE(?, cs_transaction_id),
        cs_approval_code     = COALESCE(?, cs_approval_code),
        cs_reconciliation_id = COALESCE(?, cs_reconciliation_id),
        cs_reference_code    = COALESCE(?, cs_reference_code),
        cs_response_code     = COALESCE(?, cs_response_code),
        cs_network_tx_id     = COALESCE(?, cs_network_tx_id),
        cs_status            = COALESCE(?, cs_status),
        cs_submit_time       = COALESCE(?, cs_submit_time),
        cs_simulated         = ?,
        paid_at              = COALESCE(paid_at, NOW()),
        order_status         = 'pagado'
       WHERE id = ?`,
      [
        n(cs_transaction_id), n(cs_approval_code), n(cs_reconciliation_id),
        n(cs_reference_code), n(cs_response_code), n(cs_network_tx_id),
        n(cs_status), n(cs_submit_time), cs_simulated ? 1 : 0,
        id,
      ]
    );

    logger.info('orders.payment', `Orden #${id} marcada pagada — CS ID: ${cs_transaction_id || 'simulado'}`);
    return res.json(await queryOne(
      `SELECT o.*,
              COALESCE(o.nombre_cliente, c.full_name) AS nombre_cliente,
              COALESCE(o.cedula_cliente, c.cedula)    AS cedula_cliente,
              COALESCE(o.celular_cliente, c.phone)    AS celular_cliente,
              c.email AS customer_email,
              c.phone AS customer_phone
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`,
      [id]
    ));
  } catch (err) {
    logger.error('orders.payment', err.message, err.stack);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { create, getAll, getOne, updateStatus, cancel, savePaymentDetails };
