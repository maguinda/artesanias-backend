# Artesanías Colombianas — Backend API

API REST para la tienda en línea de artesanías colombianas.  
**Stack:** Node.js + Express + MySQL

---

## Requisitos previos

| Herramienta | Versión mínima |
|---|---|
| Node.js | 18.x |
| npm | 9.x |
| MySQL | 8.0 |

---

## 1. Configurar la base de datos MySQL

```sql
CREATE DATABASE artesanias_colombianas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'artesanias'@'localhost' IDENTIFIED BY 'tu_password';
GRANT ALL PRIVILEGES ON artesanias_colombianas.* TO 'artesanias'@'localhost';
FLUSH PRIVILEGES;
```

### Ejecutar la migración (crea todas las tablas)

```bash
npm install
node src/models/migrate.js
```

Tablas creadas:

| Tabla | Descripción |
|---|---|
| `customers` | Clientes registrados (email, password, datos personales, rol) |
| `products` | Catálogo de productos (sku, nombre, precio, stock, imagen) |
| `categories` | Categorías de productos |
| `product_categories` | Relación N:M producto ↔ categoría |
| `options` | Opciones de producto (talla, color, etc.) |
| `product_options` | Relación N:M producto ↔ opción |
| `orders` | Órdenes de compra con estado y datos de envío |
| `order_details` | Líneas de detalle de cada orden |
| `cart_items` | Carrito de compras por cliente (sesión persistente) |

---

## 2. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus valores:

```env
PORT=3001
FRONTEND_URL=http://localhost:5173

JWT_SECRET=cambia-esto-por-una-clave-segura-larga
JWT_EXPIRES_IN=8h

DB_HOST=localhost
DB_PORT=3306
DB_USER=artesanias
DB_PASSWORD=tu_password
DB_NAME=artesanias_colombianas

EXTERNAL_API_BASE=https://mdiapiqa.gesyco.co/api/v1
COMPANY_ID=2

PAYMENT_API_BASE=https://tu-api-de-pagos.ngrok-free.app/api/v1
```

> **⚠️ Nunca subas el archivo `.env` al repositorio.**

---

## 3. Levantar el servidor

```bash
npm run dev     # desarrollo con hot reload (nodemon)
npm start       # producción
```

El servidor arranca en **http://localhost:3001**

---

## Estructura del proyecto

```
backend/
├── .env.example
├── package.json
└── src/
    ├── index.js                      ← punto de entrada, monta rutas
    ├── models/
    │   ├── db.js                     ← pool MySQL (query, run, queryOne, transaction)
    │   └── migrate.js                ← crea las tablas (npm run db:migrate)
    ├── middleware/
    │   ├── auth.js                   ← requireAuth, requireAdmin
    │   └── validate.js               ← validación de campos
    ├── validators/
    │   ├── auth.validators.js
    │   ├── product.validators.js
    │   └── order.validators.js
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── products.controller.js
    │   ├── categories.controller.js
    │   ├── cart.controller.js
    │   ├── orders.controller.js
    │   ├── customers.controller.js
    │   └── payment.controller.js
    └── routes/
        ├── auth.js
        ├── products.js
        ├── categories.js
        ├── cart.js
        ├── orders.js
        ├── customers.js
        └── payment.js
```

---

## API — Endpoints disponibles

### Autenticación

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Registro de nuevo cliente |
| `POST` | `/api/auth/login` | No | Login · devuelve JWT |
| `GET` | `/api/auth/me` | JWT | Ver perfil propio |
| `PUT` | `/api/auth/me` | JWT | Actualizar perfil propio |

Todas las rutas protegidas requieren el header:
```
Authorization: Bearer <token>
```

---

### Productos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/products` | JWT | Listar (local + API externa) |
| `GET` | `/api/products/:id` | JWT | Ver detalle |
| `POST` | `/api/products` | JWT + Admin | Crear producto |
| `PUT` | `/api/products/:id` | JWT + Admin | Editar producto |
| `DELETE` | `/api/products/:id` | JWT + Admin | Eliminar producto |

Query params de `GET /api/products`:
- `source`: `all` \| `local` \| `external`
- `section`: `getTop` \| `getRecommended` \| `getByCompany`
- `category`: nombre de categoría
- `page` y `limit` (paginación)

---

### Categorías

| Método | Ruta | Auth |
|---|---|---|
| `GET` | `/api/categories` | JWT |
| `GET` | `/api/categories/:id` | JWT |
| `POST` | `/api/categories` | JWT + Admin |
| `PUT` | `/api/categories/:id` | JWT + Admin |
| `DELETE` | `/api/categories/:id` | JWT + Admin |

---

### Carrito

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/cart` | JWT | Ver carrito |
| `POST` | `/api/cart` | JWT | Agregar/aumentar item |
| `PUT` | `/api/cart/:itemId` | JWT | Cambiar cantidad |
| `DELETE` | `/api/cart/:itemId` | JWT | Eliminar item |
| `DELETE` | `/api/cart` | JWT | Vaciar carrito |

---

### Órdenes

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/orders` | JWT | Crear orden (vacía el carrito) |
| `GET` | `/api/orders` | JWT | Mis órdenes (admin: todas) |
| `GET` | `/api/orders/:id` | JWT | Detalle de orden |
| `PATCH` | `/api/orders/:id/status` | JWT + Admin | Cambiar estado |
| `DELETE` | `/api/orders/:id` | JWT | Cancelar (solo si está pendiente) |

Estados válidos: `pendiente` → `pagado` → `enviado` → `entregado` | `cancelado`

Métodos de pago válidos: `efectivo`, `tarjeta`, `telefono`, `nequi`, `daviplata`, `bancolombia`, `dale`

---

### Clientes (solo Admin)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/customers` | Listar todos |
| `GET` | `/api/customers/:id` | Ver cliente con sus órdenes |
| `PUT` | `/api/customers/:id` | Editar datos o cambiar rol |
| `DELETE` | `/api/customers/:id` | Eliminar cliente |

---

### Pago

| Método | Ruta | Auth |
|---|---|---|
| `POST` | `/api/payment` | JWT |

---

## Modelo Entidad-Relación

```
customers ──< orders ──< order_details >── products
                │
                └── cart_items

categories ──< product_categories >── products

options ──< product_options >── products
```

---

## Usuarios base (creados automáticamente al migrar)

| Rol      | Email                     | Contraseña  |
|----------|---------------------------|-------------|
| Admin    | admin@artesanias.com      | Admin123    |
| Sale     | vendedor@artesanias.com   | Vendedor123 |
| Customer | cliente@artesanias.com    | Cliente123  |

> **⚠️ Cambia estas contraseñas en producción.**

---

## Logs del servidor

El backend registra todos los eventos en **`logs/app.log`**:

```
[2026-05-02T04:30:00.000Z] INFO  [server] API corriendo en http://localhost:3001
[2026-05-02T04:30:05.000Z] INFO  [http]   GET /api/products → 200 (45ms)
[2026-05-02T04:30:06.000Z] ERROR [products.update] Bind parameters must not contain undefined...
```

Para limpiar los logs:
```bash
# Windows
type nul > logs\app.log

# Linux / Mac
> logs/app.log
```

---

## Base de datos — migración adicional

Si ya tienes la BD creada, vuelve a correr la migración para agregar columnas nuevas (`vendedor_id`, `nombre_cliente`, etc.) via ALTER TABLE automático:

```bash
node src/models/migrate.js
```
