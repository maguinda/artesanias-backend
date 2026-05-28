// src/utils/email.js
// RF-22 — Confirmación de compra por correo electrónico
// Usa nodemailer. Configurar en .env: EMAIL_USER, EMAIL_PASS, EMAIL_FROM
// Si no hay credenciales, usa Ethereal (bandeja de prueba) automáticamente.
 
const dns        = require('dns');
dns.setDefaultResultOrder('ipv4first'); // fuerza IPv4 — evita ENETUNREACH en servidores sin IPv6
 
const nodemailer = require('nodemailer');
const logger     = require('./logger');
 
// ── Crear transporter ─────────────────────────────────────────────────────────
let _transporter = null;
 
async function getTransporter() {
  if (_transporter) return _transporter;
 
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
 
  if (user && pass) {
    // Gmail / SMTP real — forzar IPv4 (evita ENETUNREACH en servidores sin IPv6)
    _transporter = nodemailer.createTransport({
      host:   'smtp.gmail.com',
      port:   465,
      secure: true,
      family: 4,              // ← fuerza IPv4, evita error ENETUNREACH IPv6
      auth: { user, pass },
    });
    logger.info('email', `Transporter configurado con ${user}`);
  } else {
    // Sin credenciales → Ethereal (bandeja de prueba, ver URL en logs)
    const testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host:   'smtp.ethereal.email',
      port:   587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    logger.info('email', `Usando Ethereal (prueba). Bandeja: ${testAccount.web}`);
  }
 
  return _transporter;
}
 
// ── Formato de moneda colombiana ──────────────────────────────────────────────
function fmt(n) {
  return `$${Number(n).toLocaleString('es-CO')}`;
}
 
// ── Template HTML de confirmación de compra ───────────────────────────────────
function buildConfirmacionHTML(order, items) {
  const statusLabels = {
    pendiente: '⏳ Pendiente de pago',
    pagado:    '✅ Pagado',
    enviado:   '🚚 En camino',
    entregado: '📦 Entregado',
    cancelado: '❌ Cancelado',
  };
 
  const itemsRows = (items || []).map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0e6d3;font-weight:600;color:#2D1E0E;">
        ${item.product_name || item.sku || 'Producto'}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0e6d3;text-align:center;color:#5a4a3a;">
        ${item.quantity}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0e6d3;text-align:right;color:#5a4a3a;">
        ${fmt(item.price)}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0e6d3;text-align:right;font-weight:700;color:#2D7A2D;">
        ${fmt(item.price * item.quantity)}
      </td>
    </tr>
  `).join('');
 
  const subtotal      = (items || []).reduce((s, i) => s + i.price * i.quantity, 0);
  const shippingCost  = parseFloat(order.shipping_cost || 0);
  const isPagado      = order.order_status === 'pagado';
 
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmación de compra — Artesanías Colombianas</title>
</head>
<body style="margin:0;padding:0;background:#faf6f0;font-family:'Helvetica Neue',Arial,sans-serif;">
 
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(45,30,14,.10);">
 
        <!-- ── CABECERA ── -->
        <tr>
          <td style="background:#2D1E0E;padding:28px 36px;text-align:center;">
            <h1 style="margin:0;color:#D4A853;font-size:24px;letter-spacing:1px;">🌿 ARTESANÍAS COLOMBIANAS</h1>
            <p style="margin:8px 0 0;color:#e8d5a8;font-size:14px;">Tradición hecha a mano</p>
          </td>
        </tr>
 
        <!-- ── TÍTULO ── -->
        <tr>
          <td style="padding:32px 36px 8px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">${isPagado ? '✅' : '🛍️'}</div>
            <h2 style="margin:0;color:#2D1E0E;font-size:22px;">
              ${isPagado ? '¡Pago confirmado!' : '¡Pedido recibido!'}
            </h2>
            <p style="color:#7a6a5a;font-size:15px;margin:8px 0 0;">
              ${isPagado
                ? 'Tu pago fue procesado exitosamente. Prepararemos tu pedido pronto.'
                : 'Hemos recibido tu pedido. Está pendiente de pago.'}
            </p>
          </td>
        </tr>
 
        <!-- ── INFO ORDEN ── -->
        <tr>
          <td style="padding:20px 36px;">
            <table width="100%" style="background:#fdf8f2;border-radius:8px;border:1px solid #f0e6d3;">
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #f0e6d3;">
                  <span style="font-size:12px;font-weight:700;color:#7a6a5a;text-transform:uppercase;letter-spacing:.5px;">N° de orden</span><br/>
                  <span style="font-size:18px;font-weight:700;color:#2D1E0E;">#${order.id}</span>
                </td>
                <td style="padding:14px 18px;border-bottom:1px solid #f0e6d3;">
                  <span style="font-size:12px;font-weight:700;color:#7a6a5a;text-transform:uppercase;letter-spacing:.5px;">Fecha</span><br/>
                  <span style="font-size:14px;color:#2D1E0E;">
                    ${new Date(order.order_date || Date.now()).toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' })}
                  </span>
                </td>
                <td style="padding:14px 18px;border-bottom:1px solid #f0e6d3;">
                  <span style="font-size:12px;font-weight:700;color:#7a6a5a;text-transform:uppercase;letter-spacing:.5px;">Estado</span><br/>
                  <span style="font-size:14px;font-weight:700;color:#2D1E0E;">
                    ${statusLabels[order.order_status] || order.order_status}
                  </span>
                </td>
              </tr>
              <tr>
                <td colspan="3" style="padding:14px 18px;">
                  <span style="font-size:12px;font-weight:700;color:#7a6a5a;text-transform:uppercase;letter-spacing:.5px;">Método de pago</span><br/>
                  <span style="font-size:14px;color:#2D1E0E;text-transform:capitalize;">${order.payment_method || '—'}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
 
        <!-- ── PRODUCTOS ── -->
        ${items && items.length > 0 ? `
        <tr>
          <td style="padding:0 36px 20px;">
            <h3 style="color:#2D1E0E;font-size:15px;margin:0 0 12px;font-weight:700;">Productos comprados</h3>
            <table width="100%" style="border-collapse:collapse;border:1px solid #f0e6d3;border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#fdf8f2;">
                  <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#7a6a5a;text-transform:uppercase;">Producto</th>
                  <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#7a6a5a;text-transform:uppercase;">Cant.</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#7a6a5a;text-transform:uppercase;">Precio</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#7a6a5a;text-transform:uppercase;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>
          </td>
        </tr>
        ` : ''}
 
        <!-- ── TOTALES ── -->
        <tr>
          <td style="padding:0 36px 20px;">
            <table width="100%" style="background:#fdf8f2;border-radius:8px;border:1px solid #f0e6d3;">
              <tr>
                <td style="padding:12px 18px;color:#5a4a3a;font-size:14px;">Subtotal productos</td>
                <td style="padding:12px 18px;text-align:right;color:#5a4a3a;font-size:14px;">${fmt(subtotal)}</td>
              </tr>
              <tr>
                <td style="padding:12px 18px;color:#5a4a3a;font-size:14px;border-top:1px solid #f0e6d3;">Envío (${order.shipping_company || 'mensajería'})</td>
                <td style="padding:12px 18px;text-align:right;color:#5a4a3a;font-size:14px;border-top:1px solid #f0e6d3;">${fmt(shippingCost)}</td>
              </tr>
              <tr style="background:#2D1E0E;">
                <td style="padding:14px 18px;color:#D4A853;font-size:16px;font-weight:700;border-radius:0 0 0 8px;">TOTAL</td>
                <td style="padding:14px 18px;text-align:right;color:#D4A853;font-size:20px;font-weight:700;border-radius:0 0 8px 0;">${fmt(order.amount)}</td>
              </tr>
            </table>
          </td>
        </tr>
 
        <!-- ── DIRECCIÓN ── -->
        ${order.shipping_address ? `
        <tr>
          <td style="padding:0 36px 20px;">
            <h3 style="color:#2D1E0E;font-size:15px;margin:0 0 10px;font-weight:700;">📍 Dirección de envío</h3>
            <div style="background:#fdf8f2;border-radius:8px;border:1px solid #f0e6d3;padding:14px 18px;font-size:14px;color:#5a4a3a;line-height:1.7;">
              ${order.shipping_address}${order.barrio ? ', ' + order.barrio : ''}${order.city ? ', ' + order.city : ''}
            </div>
          </td>
        </tr>
        ` : ''}
 
        <!-- ── CTA si está pendiente ── -->
        ${!isPagado ? `
        <tr>
          <td style="padding:0 36px 28px;text-align:center;">
            <p style="color:#7a6a5a;font-size:13px;margin:0 0 14px;">Tu pedido está pendiente de pago. Ingresa a tu cuenta para completarlo.</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/mis-pedidos"
               style="display:inline-block;background:#D4A853;color:#2D1E0E;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">
              💳 Pagar ahora
            </a>
          </td>
        </tr>
        ` : ''}
 
        <!-- ── PIE ── -->
        <tr>
          <td style="background:#2D1E0E;padding:20px 36px;text-align:center;">
            <p style="margin:0;color:#e8d5a8;font-size:13px;">
              ¿Preguntas? Escríbenos a
              <a href="mailto:${process.env.EMAIL_FROM || 'artesanias@gmail.com'}" style="color:#D4A853;">${process.env.EMAIL_FROM || 'artesanias@gmail.com'}</a>
            </p>
            <p style="margin:8px 0 0;color:#7a6a5a;font-size:12px;">
              © ${new Date().getFullYear()} Artesanías Colombianas — Bogotá, Colombia
            </p>
          </td>
        </tr>
 
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}
 
// ── Función principal: enviar confirmación de compra ──────────────────────────
async function sendConfirmacionCompra(order, items, recipientEmail) {
  const email = recipientEmail
    || order.order_email
    || order.customer_email
    || null;
 
  if (!email) {
    logger.warn('email', `Orden #${order.id}: sin email — confirmación no enviada`);
    return { sent: false, reason: 'sin_email' };
  }
 
  const isPagado   = order.order_status === 'pagado';
  const subject    = isPagado
    ? `✅ Pago confirmado — Orden #${order.id} | Artesanías Colombianas`
    : `🛍️ Pedido recibido #${order.id} | Artesanías Colombianas`;
 
  const html = buildConfirmacionHTML(order, items);
 
  // Texto plano de fallback
  const textLines = [
    isPagado ? `¡Pago confirmado! Orden #${order.id}` : `¡Pedido recibido! Orden #${order.id}`,
    `Estado: ${order.order_status}`,
    `Total: ${fmt(order.amount)}`,
    `Método de pago: ${order.payment_method || '—'}`,
    '',
    'Productos:',
    ...(items || []).map(i => `  - ${i.product_name || i.sku} x${i.quantity} — ${fmt(i.price * i.quantity)}`),
    '',
    `Dirección: ${order.shipping_address || '—'}${order.city ? ', ' + order.city : ''}`,
    '',
    `Ver tus pedidos: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/mis-pedidos`,
  ];
 
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from:    process.env.EMAIL_FROM
               ? `"Artesanías Colombianas" <${process.env.EMAIL_FROM}>`
               : '"Artesanías Colombianas" <noreply@artesanias.com>',
      to:      email,
      subject,
      text:    textLines.join('\n'),
      html,
    });
 
    // Si es Ethereal, imprimir URL de preview en los logs
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      logger.info('email', `📧 Email de prueba enviado (Ethereal). Ver en: ${previewUrl}`);
    } else {
      logger.info('email', `📧 Confirmación enviada a ${email} — MessageId: ${info.messageId}`);
    }
 
    return { sent: true, messageId: info.messageId, previewUrl: previewUrl || null };
  } catch (err) {
    logger.error('email', `Error enviando a ${email}: ${err.message}`);
    return { sent: false, reason: err.message };
  }
}
 
module.exports = { sendConfirmacionCompra };