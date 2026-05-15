// src/validators/auth.validators.js
const { validate } = require('../middleware/validate');

const loginRules = validate([
  { field:'email',    required:true, isEmail:true, message:'El correo no tiene un formato válido' },
  { field:'password', required:true, minLength:6,  message:'La contraseña debe tener al menos 6 caracteres' }
]);

const registerRules = validate([
  { field:'full_name',        required:true, minLength:2, maxLength:100, message:'El nombre debe tener entre 2 y 100 caracteres' },
  { field:'email',            required:true, isEmail:true, message:'El correo no tiene un formato válido' },
  { field:'password',         required:true, minLength:6, message:'La contraseña debe tener al menos 6 caracteres' },
  { field:'confirm_password', required:true, custom:(v,b) => v!==b.password ? 'Las contraseñas no coinciden' : null },
  { field:'phone',            required:false, minLength:7, maxLength:15, message:'El teléfono no tiene un formato válido' }
]);

module.exports = { loginRules, registerRules };
