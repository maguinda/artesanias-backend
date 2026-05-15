// src/middleware/validate.js
// Validación simple sin express-validator (compatible offline)

function validate(rules) {
  return (req, res, next) => {
    const errors = [];
    for (const rule of rules) {
      const value = req.body[rule.field];
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({ field: rule.field, message: rule.message || `${rule.field} es requerido` });
        continue;
      }
      if (value !== undefined && value !== null && value !== '') {
        if (rule.isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push({ field: rule.field, message: rule.message || 'Formato de correo inválido' });
        }
        if (rule.minLength && String(value).length < rule.minLength) {
          errors.push({ field: rule.field, message: rule.message || `Mínimo ${rule.minLength} caracteres` });
        }
        if (rule.maxLength && String(value).length > rule.maxLength) {
          errors.push({ field: rule.field, message: rule.message || `Máximo ${rule.maxLength} caracteres` });
        }
        if (rule.isFloat && isNaN(parseFloat(value))) {
          errors.push({ field: rule.field, message: rule.message || 'Debe ser un número' });
        }
        if (rule.isFloat && rule.min !== undefined && parseFloat(value) < rule.min) {
          errors.push({ field: rule.field, message: rule.message || `Mínimo ${rule.min}` });
        }
        if (rule.isInt && (!Number.isInteger(Number(value)) || isNaN(Number(value)))) {
          errors.push({ field: rule.field, message: rule.message || 'Debe ser un entero' });
        }
        if (rule.isIn && !rule.isIn.includes(value)) {
          errors.push({ field: rule.field, message: rule.message || `Debe ser uno de: ${rule.isIn.join(', ')}` });
        }
        if (rule.custom) {
          const err = rule.custom(value, req.body);
          if (err) errors.push({ field: rule.field, message: err });
        }
      }
    }
    if (errors.length > 0) {
      return res.status(422).json({ error: 'Datos inválidos', details: errors });
    }
    next();
  };
}

module.exports = { validate };
