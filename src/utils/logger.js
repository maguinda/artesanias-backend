// src/utils/logger.js
const fs   = require('fs');
const path = require('path');

const LOG_DIR  = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

// Crear carpeta de logs si no existe
fs.mkdirSync(LOG_DIR, { recursive: true });

function timestamp() {
  return new Date().toISOString();
}

function write(level, context, message, extra) {
  const extraStr = extra ? `\n  Detail: ${typeof extra === 'object' ? JSON.stringify(extra, null, 2) : extra}` : '';
  const line = `[${timestamp()}] ${level.padEnd(5)} [${context}] ${message}${extraStr}\n`;

  // Consola con color
  const colors = { ERROR: '\x1b[31m', WARN: '\x1b[33m', INFO: '\x1b[36m', DEBUG: '\x1b[90m' };
  const reset  = '\x1b[0m';
  process.stdout.write(`${colors[level] || ''}${line}${reset}`);

  // Archivo de log (append)
  fs.appendFile(LOG_FILE, line, () => {});
}

const logger = {
  info:  (ctx, msg, extra) => write('INFO',  ctx, msg, extra),
  warn:  (ctx, msg, extra) => write('WARN',  ctx, msg, extra),
  error: (ctx, msg, extra) => write('ERROR', ctx, msg, extra),
  debug: (ctx, msg, extra) => write('DEBUG', ctx, msg, extra),
};

module.exports = logger;
