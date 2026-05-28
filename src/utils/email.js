// src/utils/email.js
// RF-22 — Confirmación de compra y notificaciones de estado
// Usa Resend (HTTPS) — compatible con Railway.
// Configurar en .env: RESEND_API_KEY

const { Resend } = require('resend');
const logger     = require('./logger');

// ── Cliente Resend ────────────────────────────────────────────────────────────
let _resend = null;

function getResend() {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn('email', 'RESEND_API_KEY no configurada — emails desactivados');
    return null;
  }
  _resend = new Resend(apiKey);
  logger.info('email', 'Resend configurado correctamente');
  return _resend;
}

// ── Formato moneda colombiana ─────────────────────────────────────────────────
function fmt(n) {
  return `$${Number(n).toLocaleString('es-CO')}`;
}

// ── Estilos compartidos ───────────────────────────────────────────────────────
const BASE = {
  body:    'margin:0;padding:0;background:#faf6f0;font-family:\'Helvetica Neue\',Arial,sans-serif;',
  wrapper: 'background:#faf6f0;padding:32px 0;',
  card:    'background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(45,30,14,.10);',
  header:  'background:#2D1E0E;padding:28px 36px;text-align:center;',
  footer:  'background:#2D1E0E;padding:20px 36px;text-align:center;',
};

function wrapLayout(bodyContent, order) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="${BASE.body}">
  <table width="100%" cellpadding="0" cellspacing="0" style="${BASE.wrapper}">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="${BASE.card}">

        <!-- CABECERA -->
        <tr>
          <td style="${BASE.header}">
            <h1 style="margin:0;color:#D4A853;font-size:24px;letter-spacing:1px;">🌿 ARTESANÍAS COLOMBIANAS</h1>
            <p style="margin:8px 0 0;color:#e8d5a8;font-size:14px;">Tradición hecha a mano</p>
          </td>
        </tr>

        ${bodyContent}

        <!-- PIE -->
        <tr>
          <td style="${BASE.footer}">
            <p style="margin:0;color:#e8d5a8;font-size:13px;">
              ¿Preguntas? Escríbenos a
              <a href="mailto:${process.env.EMAIL_FROM || 'artesanias@gmail.com'}" style="color:#D4A853;">
                ${process.env.EMAIL_FROM || 'artesanias@gmail.com'}
              </a>
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
</html>`.trim();
}

// ── Template: PEDIDO RECIBIDO / PAGO CONFIRMADO ───────────────────────────────
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

  const subtotal     = (items || []).reduce((s, i) => s + i.price * i.quantity, 0);
  const shippingCost = parseFloat(order.shipping_cost || 0);
  const isPagado     = order.order_status === 'pagado';

  const body = `
    <!-- TÍTULO -->
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

    <!-- INFO ORDEN -->
    <tr>
      <td style="padding:20px 36px;">
        <table width="100%" style="background:#fdf8f2;border-radius:8px;border:1px solid #f0e6d3;">
          <tr>
            <td style="padding:14px 18px;border-bottom:1px solid #f0e6d3;">
              <span style="font-size:12px;font-weight:700;color:#7a6a5a;text-transform:uppercase;">N° de orden</span><br/>
              <span style="font-size:18px;font-weight:700;color:#2D1E0E;">#${order.id}</span>
            </td>
            <td style="padding:14px 18px;border-bottom:1px solid #f0e6d3;">
              <span style="font-size:12px;font-weight:700;color:#7a6a5a;text-transform:uppercase;">Fecha</span><br/>
              <span style="font-size:14px;color:#2D1E0E;">
                ${new Date(order.order_date || Date.now()).toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' })}
              </span>
            </td>
            <td style="padding:14px 18px;border-bottom:1px solid #f0e6d3;">
              <span style="font-size:12px;font-weight:700;color:#7a6a5a;text-transform:uppercase;">Estado</span><br/>
              <span style="font-size:14px;font-weight:700;color:#2D1E0E;">
                ${statusLabels[order.order_status] || order.order_status}
              </span>
            </td>
          </tr>
          <tr>
            <td colspan="3" style="padding:14px 18px;">
              <span style="font-size:12px;font-weight:700;color:#7a6a5a;text-transform:uppercase;">Método de pago</span><br/>
              <span style="font-size:14px;color:#2D1E0E;text-transform:capitalize;">${order.payment_method || '—'}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- PRODUCTOS -->
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
          <tbody>${itemsRows}</tbody>
        </table>
      </td>
    </tr>` : ''}

    <!-- TOTALES -->
    <tr>
      <td style="padding:0 36px 20px;">
        <table width="100%" style="background:#fdf8f2;border-radius:8px;border:1px solid #f0e6d3;">
          <tr>
            <td style="padding:12px 18px;color:#5a4a3a;font-size:14px;">Subtotal productos</td>
            <td style="padding:12px 18px;text-align:right;color:#5a4a3a;font-size:14px;">${fmt(subtotal)}</td>
          </tr>
          <tr>
            <td style="padding:12px 18px;color:#5a4a3a;font-size:14px;border-top:1px solid #f0e6d3;">
              Envío (${order.shipping_company || 'mensajería'})
            </td>
            <td style="padding:12px 18px;text-align:right;color:#5a4a3a;font-size:14px;border-top:1px solid #f0e6d3;">${fmt(shippingCost)}</td>
          </tr>
          <tr style="background:#2D1E0E;">
            <td style="padding:14px 18px;color:#D4A853;font-size:16px;font-weight:700;">TOTAL</td>
            <td style="padding:14px 18px;text-align:right;color:#D4A853;font-size:20px;font-weight:700;">${fmt(order.amount)}</td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- DIRECCIÓN -->
    ${order.shipping_address ? `
    <tr>
      <td style="padding:0 36px 20px;">
        <h3 style="color:#2D1E0E;font-size:15px;margin:0 0 10px;font-weight:700;">📍 Dirección de envío</h3>
        <div style="background:#fdf8f2;border-radius:8px;border:1px solid #f0e6d3;padding:14px 18px;font-size:14px;color:#5a4a3a;line-height:1.7;">
          ${order.shipping_address}${order.barrio ? ', ' + order.barrio : ''}${order.city ? ', ' + order.city : ''}
        </div>
      </td>
    </tr>` : ''}

    <!-- CTA pendiente -->
    ${!isPagado ? `
    <tr>
      <td style="padding:0 36px 28px;text-align:center;">
        <p style="color:#7a6a5a;font-size:13px;margin:0 0 14px;">Tu pedido está pendiente de pago. Ingresa a tu cuenta para completarlo.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/mis-pedidos"
           style="display:inline-block;background:#D4A853;color:#2D1E0E;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">
          💳 Pagar ahora
        </a>
      </td>
    </tr>` : ''}
  `;

  return wrapLayout(body, order);
}

// ── Template: ENVIADO 🚚 ──────────────────────────────────────────────────────
function buildEnviadoHTML(order, items) {
  const body = `
    <!-- BANNER ENVIADO -->
    <tr>
      <td style="background:linear-gradient(135deg,#1a6b9a 0%,#2196b8 100%);padding:36px;text-align:center;">
        <div style="font-size:64px;margin-bottom:12px;">🚚</div>
        <h2 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">¡Tu pedido está en camino!</h2>
        <p style="margin:10px 0 0;color:#cceeff;font-size:15px;">
          Pronto llegará a tus manos con mucho cariño.
        </p>
      </td>
    </tr>

    <!-- INFO ORDEN -->
    <tr>
      <td style="padding:24px 36px 0;">
        <table width="100%" style="background:#f0f8ff;border-radius:8px;border:1px solid #b3d9f0;">
          <tr>
            <td style="padding:14px 18px;border-bottom:1px solid #b3d9f0;">
              <span style="font-size:12px;font-weight:700;color:#5a8a9a;text-transform:uppercase;">N° de orden</span><br/>
              <span style="font-size:20px;font-weight:800;color:#1a6b9a;">#${order.id}</span>
            </td>
            <td style="padding:14px 18px;border-bottom:1px solid #b3d9f0;">
              <span style="font-size:12px;font-weight:700;color:#5a8a9a;text-transform:uppercase;">Empresa de envío</span><br/>
              <span style="font-size:15px;font-weight:700;color:#1a3a5a;">${order.shipping_company || 'Mensajería'}</span>
            </td>
            <td style="padding:14px 18px;border-bottom:1px solid #b3d9f0;">
              <span style="font-size:12px;font-weight:700;color:#5a8a9a;text-transform:uppercase;">Estado</span><br/>
              <span style="font-size:15px;font-weight:700;color:#1a6b9a;">🚚 En camino</span>
            </td>
          </tr>
          ${order.shipping_address ? `
          <tr>
            <td colspan="3" style="padding:14px 18px;">
              <span style="font-size:12px;font-weight:700;color:#5a8a9a;text-transform:uppercase;">📍 Dirección de entrega</span><br/>
              <span style="font-size:14px;color:#1a3a5a;">
                ${order.shipping_address}${order.barrio ? ', ' + order.barrio : ''}${order.city ? ', ' + order.city : ''}
              </span>
            </td>
          </tr>` : ''}
        </table>
      </td>
    </tr>

    <!-- PRODUCTOS ENVIADOS -->
    ${items && items.length > 0 ? `
    <tr>
      <td style="padding:20px 36px 0;">
        <h3 style="color:#1a3a5a;font-size:15px;margin:0 0 12px;font-weight:700;">📦 Productos en camino</h3>
        <table width="100%" style="border-collapse:collapse;border:1px solid #b3d9f0;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#e0f2fc;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#5a8a9a;text-transform:uppercase;">Producto</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#5a8a9a;text-transform:uppercase;">Cant.</th>
            </tr>
          </thead>
          <tbody>
            ${(items || []).map(item => `
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #e0f2fc;font-weight:600;color:#1a3a5a;">
                ${item.product_name || item.sku || 'Producto'}
              </td>
              <td style="padding:10px 12px;border-bottom:1px solid #e0f2fc;text-align:center;color:#5a8a9a;">
                ${item.quantity}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </td>
    </tr>` : ''}

    <!-- PASOS DE ENTREGA -->
    <tr>
      <td style="padding:20px 36px;">
        <div style="background:#f0f8ff;border-radius:8px;border:1px solid #b3d9f0;padding:20px 24px;">
          <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1a3a5a;">¿Qué sigue?</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:36px;vertical-align:top;padding-bottom:12px;">
                <div style="width:28px;height:28px;background:#1a6b9a;border-radius:50%;text-align:center;line-height:28px;color:#fff;font-weight:700;font-size:13px;">1</div>
              </td>
              <td style="padding-left:12px;padding-bottom:12px;vertical-align:top;font-size:14px;color:#1a3a5a;">
                La empresa de mensajería recoge tu paquete y lo pone en ruta.
              </td>
            </tr>
            <tr>
              <td style="width:36px;vertical-align:top;padding-bottom:12px;">
                <div style="width:28px;height:28px;background:#1a6b9a;border-radius:50%;text-align:center;line-height:28px;color:#fff;font-weight:700;font-size:13px;">2</div>
              </td>
              <td style="padding-left:12px;padding-bottom:12px;vertical-align:top;font-size:14px;color:#1a3a5a;">
                Recibirás tu pedido en la dirección registrada. ¡Ten a alguien disponible!
              </td>
            </tr>
            <tr>
              <td style="width:36px;vertical-align:top;">
                <div style="width:28px;height:28px;background:#2D7A2D;border-radius:50%;text-align:center;line-height:28px;color:#fff;font-weight:700;font-size:13px;">3</div>
              </td>
              <td style="padding-left:12px;vertical-align:top;font-size:14px;color:#1a3a5a;">
                Al recibir, revisa que todo esté en perfecto estado. ¡Gracias por tu compra!
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>

    <!-- CTA -->
    <tr>
      <td style="padding:0 36px 28px;text-align:center;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/mis-pedidos"
           style="display:inline-block;background:#1a6b9a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">
          📋 Ver mis pedidos
        </a>
      </td>
    </tr>
  `;
  return wrapLayout(body, order);
}

// ── Template: ENTREGADO 📦 ────────────────────────────────────────────────────
function buildEntregadoHTML(order, items) {
  const body = `
    <!-- BANNER ENTREGADO -->
    <tr>
      <td style="background:linear-gradient(135deg,#1a7a2a 0%,#2D7A2D 100%);padding:36px;text-align:center;">
        <div style="font-size:64px;margin-bottom:12px;">📦</div>
        <h2 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">¡Tu pedido fue entregado!</h2>
        <p style="margin:10px 0 0;color:#b3f0b3;font-size:15px;">
          Esperamos que disfrutes tus artesanías. ¡Gracias por tu compra!
        </p>
      </td>
    </tr>

    <!-- RESUMEN -->
    <tr>
      <td style="padding:24px 36px 0;">
        <table width="100%" style="background:#f2fdf2;border-radius:8px;border:1px solid #a3d9a3;">
          <tr>
            <td style="padding:14px 18px;border-bottom:1px solid #a3d9a3;">
              <span style="font-size:12px;font-weight:700;color:#4a8a4a;text-transform:uppercase;">N° de orden</span><br/>
              <span style="font-size:20px;font-weight:800;color:#1a5a1a;">#${order.id}</span>
            </td>
            <td style="padding:14px 18px;border-bottom:1px solid #a3d9a3;">
              <span style="font-size:12px;font-weight:700;color:#4a8a4a;text-transform:uppercase;">Total pagado</span><br/>
              <span style="font-size:18px;font-weight:800;color:#1a5a1a;">${fmt(order.amount)}</span>
            </td>
            <td style="padding:14px 18px;border-bottom:1px solid #a3d9a3;">
              <span style="font-size:12px;font-weight:700;color:#4a8a4a;text-transform:uppercase;">Estado</span><br/>
              <span style="font-size:15px;font-weight:700;color:#1a5a1a;">📦 Entregado</span>
            </td>
          </tr>
          ${order.shipping_address ? `
          <tr>
            <td colspan="3" style="padding:14px 18px;">
              <span style="font-size:12px;font-weight:700;color:#4a8a4a;text-transform:uppercase;">📍 Entregado en</span><br/>
              <span style="font-size:14px;color:#1a3a1a;">
                ${order.shipping_address}${order.barrio ? ', ' + order.barrio : ''}${order.city ? ', ' + order.city : ''}
              </span>
            </td>
          </tr>` : ''}
        </table>
      </td>
    </tr>

    <!-- PRODUCTOS ENTREGADOS -->
    ${items && items.length > 0 ? `
    <tr>
      <td style="padding:20px 36px 0;">
        <h3 style="color:#1a3a1a;font-size:15px;margin:0 0 12px;font-weight:700;">✅ Productos entregados</h3>
        <table width="100%" style="border-collapse:collapse;border:1px solid #a3d9a3;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#d4f0d4;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#4a8a4a;text-transform:uppercase;">Producto</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#4a8a4a;text-transform:uppercase;">Cant.</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#4a8a4a;text-transform:uppercase;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(items || []).map(item => `
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #d4f0d4;font-weight:600;color:#1a3a1a;">
                ${item.product_name || item.sku || 'Producto'}
              </td>
              <td style="padding:10px 12px;border-bottom:1px solid #d4f0d4;text-align:center;color:#4a8a4a;">
                ${item.quantity}
              </td>
              <td style="padding:10px 12px;border-bottom:1px solid #d4f0d4;text-align:right;font-weight:700;color:#1a5a1a;">
                ${fmt(item.price * item.quantity)}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </td>
    </tr>` : ''}

    <!-- MENSAJE CÁLIDO -->
    <tr>
      <td style="padding:20px 36px;">
        <div style="background:#f2fdf2;border-radius:8px;border:1px solid #a3d9a3;padding:20px 24px;text-align:center;">
          <p style="margin:0;font-size:15px;color:#1a3a1a;line-height:1.7;">
            🌿 Cada pieza que creamos lleva el alma de nuestros artesanos colombianos.<br/>
            <strong>¡Gracias por apoyar el arte y la tradición de Colombia!</strong>
          </p>
        </div>
      </td>
    </tr>

    <!-- CTA -->
    <tr>
      <td style="padding:0 36px 28px;text-align:center;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}"
           style="display:inline-block;background:#2D7A2D;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;margin-right:12px;">
          🛍️ Seguir comprando
        </a>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/mis-pedidos"
           style="display:inline-block;background:#f0f0f0;color:#1a3a1a;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">
          📋 Mis pedidos
        </a>
      </td>
    </tr>
  `;
  return wrapLayout(body, order);
}

// ── Template: CANCELADO ❌ ────────────────────────────────────────────────────
function buildCanceladoHTML(order, items) {
  const body = `
    <!-- BANNER CANCELADO -->
    <tr>
      <td style="background:linear-gradient(135deg,#7a1a1a 0%,#a83232 100%);padding:36px;text-align:center;">
        <div style="font-size:64px;margin-bottom:12px;">❌</div>
        <h2 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">Pedido cancelado</h2>
        <p style="margin:10px 0 0;color:#f0c0c0;font-size:15px;">
          Tu orden #${order.id} ha sido cancelada.
        </p>
      </td>
    </tr>

    <!-- INFO ORDEN -->
    <tr>
      <td style="padding:24px 36px 0;">
        <table width="100%" style="background:#fff5f5;border-radius:8px;border:1px solid #f0b3b3;">
          <tr>
            <td style="padding:14px 18px;border-bottom:1px solid #f0b3b3;">
              <span style="font-size:12px;font-weight:700;color:#9a4a4a;text-transform:uppercase;">N° de orden</span><br/>
              <span style="font-size:20px;font-weight:800;color:#7a1a1a;">#${order.id}</span>
            </td>
            <td style="padding:14px 18px;border-bottom:1px solid #f0b3b3;">
              <span style="font-size:12px;font-weight:700;color:#9a4a4a;text-transform:uppercase;">Monto</span><br/>
              <span style="font-size:18px;font-weight:800;color:#7a1a1a;">${fmt(order.amount)}</span>
            </td>
            <td style="padding:14px 18px;border-bottom:1px solid #f0b3b3;">
              <span style="font-size:12px;font-weight:700;color:#9a4a4a;text-transform:uppercase;">Estado</span><br/>
              <span style="font-size:15px;font-weight:700;color:#7a1a1a;">❌ Cancelado</span>
            </td>
          </tr>
          <tr>
            <td colspan="3" style="padding:14px 18px;">
              <span style="font-size:12px;font-weight:700;color:#9a4a4a;text-transform:uppercase;">Método de pago</span><br/>
              <span style="font-size:14px;color:#7a1a1a;text-transform:capitalize;">${order.payment_method || '—'}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- PRODUCTOS CANCELADOS -->
    ${items && items.length > 0 ? `
    <tr>
      <td style="padding:20px 36px 0;">
        <h3 style="color:#7a1a1a;font-size:15px;margin:0 0 12px;font-weight:700;">Productos de la orden cancelada</h3>
        <table width="100%" style="border-collapse:collapse;border:1px solid #f0b3b3;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#ffe0e0;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#9a4a4a;text-transform:uppercase;">Producto</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#9a4a4a;text-transform:uppercase;">Cant.</th>
            </tr>
          </thead>
          <tbody>
            ${(items || []).map(item => `
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #ffe0e0;font-weight:600;color:#7a1a1a;text-decoration:line-through;opacity:0.7;">
                ${item.product_name || item.sku || 'Producto'}
              </td>
              <td style="padding:10px 12px;border-bottom:1px solid #ffe0e0;text-align:center;color:#9a4a4a;opacity:0.7;">
                ${item.quantity}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </td>
    </tr>` : ''}

    <!-- AVISO REEMBOLSO -->
    <tr>
      <td style="padding:20px 36px;">
        <div style="background:#fff5f5;border-left:4px solid #a83232;border-radius:0 8px 8px 0;padding:16px 20px;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#7a1a1a;">ℹ️ Sobre tu reembolso</p>
          <p style="margin:0;font-size:14px;color:#5a2a2a;line-height:1.6;">
            Si realizaste un pago, el reembolso será procesado en un plazo de <strong>3 a 5 días hábiles</strong>
            según tu entidad bancaria. Si tienes dudas, contáctanos.
          </p>
        </div>
      </td>
    </tr>

    <!-- CTA -->
    <tr>
      <td style="padding:0 36px 28px;text-align:center;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}"
           style="display:inline-block;background:#a83232;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">
          🛍️ Ver productos
        </a>
      </td>
    </tr>
  `;
  return wrapLayout(body, order);
}

// ── Enviar email según estado ─────────────────────────────────────────────────
async function sendEmailByStatus(order, items, recipientEmail, status) {
  const configs = {
    pendiente: {
      subject: `🛍️ Pedido recibido #${order.id} | Artesanías Colombianas`,
      html:    () => buildConfirmacionHTML({ ...order, order_status: 'pendiente' }, items),
    },
    pagado: {
      subject: `✅ Pago confirmado — Orden #${order.id} | Artesanías Colombianas`,
      html:    () => buildConfirmacionHTML({ ...order, order_status: 'pagado' }, items),
    },
    enviado: {
      subject: `🚚 Tu pedido #${order.id} está en camino | Artesanías Colombianas`,
      html:    () => buildEnviadoHTML(order, items),
    },
    entregado: {
      subject: `📦 ¡Tu pedido #${order.id} fue entregado! | Artesanías Colombianas`,
      html:    () => buildEntregadoHTML(order, items),
    },
    cancelado: {
      subject: `❌ Orden #${order.id} cancelada | Artesanías Colombianas`,
      html:    () => buildCanceladoHTML(order, items),
    },
  };

  const cfg = configs[status];
  if (!cfg) return { sent: false, reason: 'estado_sin_template' };

  const email = recipientEmail || order.order_email || order.customer_email;
  if (!email) {
    logger.warn('email', `Orden #${order.id}: sin email — notificación no enviada`);
    return { sent: false, reason: 'sin_email' };
  }

  const resend = getResend();
  if (!resend) return { sent: false, reason: 'sin_api_key' };

  try {
    const { data, error } = await resend.emails.send({
      from:    'onboarding@resend.dev',
      to:      email,
      subject: cfg.subject,
      html:    cfg.html(),
    });

    if (error) {
      logger.error('email', `Error Resend [${status}] a ${email}: ${error.message}`);
      return { sent: false, reason: error.message };
    }

    logger.info('email', `📧 Email [${status}] enviado a ${email} — Resend ID: ${data.id}`);
    return { sent: true, messageId: data.id };

  } catch (err) {
    logger.error('email', `Error enviando [${status}] a ${email}: ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

// ── Función legacy (compatibilidad con código existente) ──────────────────────
async function sendConfirmacionCompra(order, items, recipientEmail) {
  return sendEmailByStatus(order, items, recipientEmail, order.order_status);
}

module.exports = { sendConfirmacionCompra, sendEmailByStatus };