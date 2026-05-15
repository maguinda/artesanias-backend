// src/validators/order.validators.js
const { validate } = require('../middleware/validate');

const orderRules = validate([
  { field:'items',            required:true, custom:(v)=>!Array.isArray(v)||v.length<1?'El carrito debe tener al menos un producto':null },
  { field:'shipping_address', required:true, message:'La dirección de envío es requerida' },
  { field:'city',             required:true, message:'La ciudad es requerida' },
  { field:'payment_method',   required:true, isIn:['efectivo','tarjeta','telefono','nequi','daviplata','bancolombia','dale'], message:'Método de pago no válido' }
]);

const cartItemRules = validate([
  { field:'product_id',   required:true, isInt:true, message:'product_id debe ser un número entero' },
  { field:'quantity',     required:true, isInt:true, min:1, message:'La cantidad debe ser al menos 1' },
  { field:'price',        required:true, isFloat:true, min:0, message:'El precio debe ser un número positivo' },
  { field:'product_name', required:true, message:'El nombre del producto es requerido' }
]);

module.exports = { orderRules, cartItemRules };
