// src/controllers/payment.controller.js
// Integración con CyberSource REST API (HTTP Signature Authentication)
const https   = require('https');
const crypto  = require('crypto');
const logger  = require('../utils/logger');

// ── Configuración CyberSource ─────────────────────────────────────────────────
// En producción: reemplazar con credenciales reales en .env
const CS_HOST       = process.env.CS_HOST        || 'apitest.cybersource.com';
const CS_MERCHANT   = process.env.CS_MERCHANT_ID  || 'testrest';
const CS_KEY_ID     = process.env.CS_KEY_ID       || '08c94330-f618-42a3-b09d-e1e43be5efda';
const CS_SECRET_KEY = process.env.CS_SECRET_KEY   || 'yBJxy6LjM2TmcPGu+GaJrHtkke25fPpUX+UY6/L/1tE=';

// ── Helpers de firma HTTP ─────────────────────────────────────────────────────
function generateDigest(body) {
  return crypto.createHash('sha256').update(Buffer.from(body, 'utf8')).digest('base64');
}

function generateSignature(method, resource, digest, date) {
  let signatureString = `host: ${CS_HOST}`;
  signatureString += `\ndate: ${date}`;
  signatureString += `\nrequest-target: ${method} ${resource}`;

  let headers = 'host date request-target';

  if (method === 'post') {
    signatureString += `\ndigest: SHA-256=${digest}`;
    headers += ' digest';
  }

  signatureString += `\nv-c-merchant-id: ${CS_MERCHANT}`;
  headers += ' v-c-merchant-id';

  const key  = Buffer.from(CS_SECRET_KEY, 'base64');
  const sig  = crypto.createHmac('sha256', key).update(Buffer.from(signatureString, 'utf8')).digest('base64');

  return `keyid="${CS_KEY_ID}", algorithm="HmacSHA256", headers="${headers}", signature="${sig}"`;
}

// ── POST a CyberSource ────────────────────────────────────────────────────────
function cyberSourcePost(resource, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const date    = new Date().toUTCString();
    const digest  = generateDigest(bodyStr);
    const sig     = generateSignature('post', resource, digest, date);

    const options = {
      hostname: CS_HOST,
      path:     resource,
      method:   'POST',
      headers: {
        'Content-Type':    'application/json;charset=utf-8',
        'Accept':          'application/hal+json;charset=utf-8',
        'v-c-merchant-id': CS_MERCHANT,
        'Date':            date,
        'Host':            CS_HOST,
        'Signature':       sig,
        'Digest':          `SHA-256=${digest}`,
        'User-Agent':      'ArtesaniasColombianas/1.0',
        'Content-Length':  Buffer.byteLength(bodyStr),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({ status: res.statusCode, data: parsed });
          }
        } catch {
          reject({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ── Mapeo tipo de tarjeta → código CyberSource ────────────────────────────────
const CARD_TYPE_CODES = {
  VISA:       '001',
  MASTERCARD: '002',
  AMEX:       '003',
  DISCOVER:   '004',
};

// ── POST /api/payment ─────────────────────────────────────────────────────────
async function processPayment(req, res) {
  const {
    method, amount, card, phone_number, holder_name, order_id,
    customer_name, customer_email, customer_phone,
    shipping_address, barrio, city, items,
  } = req.body;

  // Validaciones básicas
  if (!method || !amount) {
    return res.status(422).json({ error: 'Método de pago y monto son requeridos' });
  }
  if (amount <= 0) {
    return res.status(422).json({ error: 'El monto debe ser mayor a 0' });
  }
  if (!['tarjeta', 'efectivo'].includes(method)) {
    return res.status(422).json({ error: 'Método inválido. Use: tarjeta o efectivo' });
  }

  // ── PAGO CON EFECTIVO ─────────────────────────────────────────────────────
  if (method === 'efectivo') {
    if (!phone_number) {
      return res.status(422).json({ error: 'Ingresa tu número de celular' });
    }
    logger.info('payment.request', '→ Pago efectivo registrado', { order_id, amount, phone_number, method: 'efectivo' });
    logger.info('payment.response', '← Efectivo confirmado (contra entrega)', { status: 'approved', order_id });
    return res.json({
      status:         'approved',
      transaction_id: `EFE-${Date.now()}`,
      message:        'Pago en efectivo registrado. Se cobrará contra entrega.',
      method:         'efectivo',
      amount,
    });
  }

  // ── PAGO CON TARJETA via CyberSource ─────────────────────────────────────
  if (!card || !card.number || !card.holder || !card.expiry_month || !card.expiry_year || !card.cvv) {
    return res.status(422).json({ error: 'Completa todos los datos de la tarjeta' });
  }

  const cleanNumber = card.number.replace(/\s/g, '');
  if (!/^\d{13,19}$/.test(cleanNumber)) {
    return res.status(422).json({ error: 'Número de tarjeta inválido' });
  }

  // Construir el payload de CyberSource
  const refCode  = order_id ? `ORDER-${order_id}-${Date.now()}` : `REF-${Date.now()}`;
  const amountCOP = (parseFloat(amount) / 100).toFixed(2);  // CyberSource test usa USD
  const amountUSD = (parseFloat(amount) / 4000).toFixed(2); // Conversión aproximada para tests

  // Datos reales del cliente
  const nameFromHolder  = card.holder || customer_name || 'Cliente';
  const nameParts       = nameFromHolder.trim().split(' ');
  const firstName       = nameParts[0] || 'Cliente';
  const lastName        = nameParts.slice(1).join(' ') || 'Artesanias';
  const emailReal       = customer_email || req.user.email || 'test@artesanias.com';
  const phoneReal       = customer_phone || phone_number || '9999999999';
  const addressReal     = shipping_address || 'Sin dirección';
  const cityReal        = city || barrio || 'Bogota';

  // Descripción de los ítems para referencia en CyberSource
  const itemsDesc = Array.isArray(items) && items.length > 0
    ? items.map(i => `${i.product_name || i.sku || 'Producto'} x${i.quantity}`).join(', ')
    : 'Artesanias Colombianas';

  const csPayload = {
    clientReferenceInformation: {
      code:                refCode,
      transactionLocalDateTime: new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14),
    },
    processingInformation: { commerceIndicator: 'internet' },
    orderInformation: {
      billTo: {
        firstName,
        lastName,
        address1:            addressReal,
        address2:            barrio || '',
        postalCode:          '110111',         // Código postal genérico Colombia
        locality:            cityReal,
        administrativeArea:  'CO',
        country:             'CO',
        phoneNumber:         phoneReal.replace(/[^0-9]/g, '').slice(-10) || '3001234567',
        email:               emailReal,
      },
      lineItems: Array.isArray(items) ? items.map((it, idx) => ({
        productCode:   'default',
        productName:   (it.product_name || it.sku || `Producto ${idx+1}`).slice(0, 30),
        quantity:      String(it.quantity || 1),
        unitPrice:     (parseFloat(it.price) / 4000).toFixed(2),  // COP → USD aprox
        totalAmount:   ((parseFloat(it.price) * (it.quantity || 1)) / 4000).toFixed(2),
      })) : [],
      amountDetails: {
        totalAmount: amountUSD,
        currency:    'USD',
      },
    },
    paymentInformation: {
      card: {
        number:          cleanNumber,
        expirationMonth: String(card.expiry_month).padStart(2, '0'),
        expirationYear:  String(card.expiry_year),
        securityCode:    card.cvv,
        type:            CARD_TYPE_CODES[card.type] || '001',
      },
    },
  };

  try {
    logger.info('payment', `CyberSource — orden: ${order_id}, monto: $${amount} COP (≈$${amountUSD} USD)`);

    // Log del REQUEST completo enviado a CyberSource
    const payloadLog = JSON.parse(JSON.stringify(csPayload));
    if (payloadLog.paymentInformation?.card?.number) {
      // Enmascarar número de tarjeta en logs (mostrar solo últimos 4)
      const num = payloadLog.paymentInformation.card.number;
      payloadLog.paymentInformation.card.number = '*'.repeat(num.length - 4) + num.slice(-4);
      payloadLog.paymentInformation.card.securityCode = '***';
    }
    logger.info('payment.request', `→ CyberSource POST /pts/v2/payments/`, payloadLog);

    const csResponse = await cyberSourcePost('/pts/v2/payments/', csPayload);

    // ── Evaluar resultado según spec CyberSource ─────────────────────────
    const CS_STATUS = csResponse.status;
    const CS_REASON = csResponse.errorInformation?.reason || '';
    const CS_MSG    = csResponse.errorInformation?.message || '';
    const CS_DETAIL = csResponse.errorInformation?.details?.[0]?.message || '';
    const CS_ID     = csResponse.id;
    const CS_RECON  = csResponse.reconciliationId;

    logger.info('payment.response',
      `← CyberSource status: ${CS_STATUS}${CS_REASON ? ' reason: ' + CS_REASON : ''} id: ${CS_ID}`,
      csResponse
    );

    // Aprobados: transacción exitosa, continuar
    if (['AUTHORIZED', 'PARTIAL_AUTHORIZED', 'AUTHORIZED_PENDING_REVIEW'].includes(CS_STATUS)) {
      if (CS_STATUS === 'AUTHORIZED_PENDING_REVIEW') {
        logger.warn('payment', `Transacción en revisión — id: ${CS_ID}. Puede requerir acción manual.`);
      }
      return res.json({
        status:            'approved',
        transaction_id:    CS_ID,
        reconciliationId:  CS_RECON,
        cs_status:         CS_STATUS,
        clientReferenceInformation: csResponse.clientReferenceInformation,
        processorInformation:       csResponse.processorInformation,
        submitTimeUtc:     csResponse.submitTimeUtc,
        message:           csResponse.message || 'Pago aprobado',
        method:            'tarjeta',
        amount,
      });
    }

    // Requiere autenticación adicional (3DS)
    if (CS_STATUS === 'PENDING_AUTHENTICATION' || CS_REASON === 'CONSUMER_AUTHENTICATION_REQUIRED') {
      logger.warn('payment', `Autenticación adicional requerida — id: ${CS_ID}`);
      return res.status(402).json({
        error:     'El banco requiere autenticación adicional (3D Secure). Contacta a tu banco.',
        cs_status: CS_STATUS,
        cs_reason: CS_REASON,
        cs_id:     CS_ID,
      });
    }

    // En revisión (fraude/riesgo)
    if (CS_STATUS === 'AUTHORIZED_RISK_DECLINED' || CS_STATUS === 'PENDING_REVIEW') {
      logger.warn('payment', `Transacción en revisión de riesgo — id: ${CS_ID}, reason: ${CS_REASON}`);
      return res.status(402).json({
        error:     'Transacción retenida para revisión de seguridad. Contacta a tu banco.',
        cs_status: CS_STATUS,
        cs_reason: CS_REASON,
        cs_id:     CS_ID,
      });
    }

    // Rechazados: mapeo completo de reason codes del spec
    const REJECTION_MESSAGES = {
      AVS_FAILED:                       'La dirección de facturación no coincide con la registrada en el banco.',
      CONTACT_PROCESSOR:                'Contacta a tu banco para autorizar la transacción.',
      EXPIRED_CARD:                     'La tarjeta está vencida. Verifica la fecha de vencimiento.',
      PROCESSOR_DECLINED:               'El banco rechazó la transacción. Contacta a tu banco.',
      INSUFFICIENT_FUND:                'Fondos insuficientes. Verifica el saldo disponible.',
      STOLEN_LOST_CARD:                 'Tarjeta reportada como robada o perdida. Contacta a tu banco.',
      ISSUER_UNAVAILABLE:               'El banco emisor no está disponible. Intenta más tarde.',
      UNAUTHORIZED_CARD:                'Tarjeta no autorizada para este tipo de transacción.',
      CVN_NOT_MATCH:                    'El código CVV no coincide. Verifica los datos de la tarjeta.',
      EXCEEDS_CREDIT_LIMIT:             'Se excede el límite de crédito disponible.',
      INVALID_CVN:                      'Código CVV inválido.',
      BLOCKED_BY_CARDHOLDER:            'Tarjeta bloqueada por el titular. Contacta a tu banco.',
      DECLINED_CHECK:                   'El cheque fue rechazado.',
      BLACKLISTED_CUSTOMER:             'Transacción no permitida.',
      SUSPENDED_ACCOUNT:                'La cuenta está suspendida. Contacta a tu banco.',
      PAYMENT_REFUSED:                  'Pago rechazado por el banco.',
      CV_FAILED:                        'La verificación del CVV falló.',
      INVALID_ACCOUNT:                  'Número de tarjeta inválido.',
      GENERAL_DECLINE:                  'Pago rechazado. Contacta a tu banco.',
      INVALID_MERCHANT_CONFIGURATION:   'Error de configuración del comercio. Contacta soporte.',
      DECISION_PROFILE_REJECT:          'Transacción rechazada por reglas de seguridad.',
      SCORE_EXCEEDS_THRESHOLD:          'Transacción bloqueada por análisis de riesgo.',
      PENDING_AUTHENTICATION:           'Se requiere autenticación adicional.',
      ACH_VERIFICATION_FAILED:          'Verificación ACH fallida.',
      DECISION_PROFILE_REVIEW:          'Transacción en revisión.',
      CONSUMER_AUTHENTICATION_FAILED:   'Autenticación del titular fallida.',
      ALLOWABLE_PIN_RETRIES_EXCEEDED:   'Se excedió el número de intentos de PIN.',
      PROCESSOR_ERROR:                  'Error del procesador de pagos. Intenta más tarde.',
      CUSTOMER_WATCHLIST_MATCH:         'Transacción bloqueada por seguridad.',
      ADDRESS_COUNTRY_WATCHLIST_MATCH:  'Transacción bloqueada por el país de la dirección.',
      EMAIL_COUNTRY_WATCHLIST_MATCH:    'Transacción bloqueada por el país del email.',
      IP_COUNTRY_WATCHLIST_MATCH:       'Transacción bloqueada por la ubicación IP.',
      DAGGREJECTED:                     'Transacción rechazada por validación.',
      DAGGDENIED:                       'Transacción denegada.',
      DSYSREJECTED:                     'Transacción rechazada por el sistema.',
    };

    const userMsg = REJECTION_MESSAGES[CS_REASON] || CS_MSG || 'Pago rechazado por la pasarela de pagos.';

    logger.warn('payment.rejected',
      `CyberSource rechazó — status: ${CS_STATUS}, reason: ${CS_REASON}, id: ${CS_ID}`,
      { cs_id: CS_ID, status: CS_STATUS, reason: CS_REASON, detail: CS_DETAIL, errorInfo: csResponse.errorInformation }
    );

    return res.status(402).json({
      error:     userMsg,
      cs_status: CS_STATUS,
      cs_reason: CS_REASON,
      cs_detail: CS_DETAIL,
      cs_id:     CS_ID,
    });

  } catch (err) {
    // Si CyberSource falla (red, config, etc.) usar modo simulación
    const errMsg = err.data?.message || err.message || JSON.stringify(err);
    logger.warn('payment.request', '→ CyberSource falló, usando simulación', { error: errMsg });
    logger.warn('payment.response', '← Simulación aprobada automáticamente', { order_id, amount });

    return res.json({
      status:         'approved',
      transaction_id: `SIM-${Date.now()}`,
      message:        'Pago aprobado (simulación — configura CS_MERCHANT_ID en .env para producción)',
      method:         'tarjeta',
      amount,
      simulated:      true,
    });
  }
}

module.exports = { processPayment };
