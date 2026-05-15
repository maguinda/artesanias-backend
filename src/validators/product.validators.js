// src/validators/product.validators.js
const { validate } = require('../middleware/validate');

const productRules = validate([
  { field:'sku',   required:true, maxLength:50,   message:'El SKU es requerido (máx 50 caracteres)' },
  { field:'name',  required:true, minLength:2, maxLength:200, message:'El nombre debe tener entre 2 y 200 caracteres' },
  { field:'price', required:true, isFloat:true, min:0, message:'El precio debe ser un número positivo' },
  { field:'stock', required:true, isInt:true,   message:'El stock debe ser un número entero' }
]);

const listProductsRules = validate([
  { field:'section', required:false, isIn:['getTop','getRecommended','getByCompany'], message:'section debe ser getTop, getRecommended o getByCompany' }
]);

module.exports = { productRules, listProductsRules };
