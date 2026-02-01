# ADM Shop - Postman Collections

## Archivos

- `ADM-Shop-Complete.postman_collection.json` - Colección completa con todos los endpoints
- `ADM-Shop-Payments.postman_collection.json` - Solo endpoints de pagos
- `ADM-Shop-Local.postman_environment.json` - Variables de entorno para desarrollo local

## Importar en Postman

1. Abre Postman
2. Click en **Import** (esquina superior izquierda)
3. Arrastra los archivos `.json` o selecciónalos
4. Importa tanto la colección como el environment

## Configurar Environment

1. En Postman, selecciona el environment **ADM Shop - Local** (esquina superior derecha)
2. La variable `baseUrl` está configurada como `http://localhost:3000/api/v1`

## Flujo de Pruebas Recomendado

### Paso 1: Iniciar el servidor
```bash
npm run start:dev
```

### Paso 2: Ejecutar el Seed (crear datos de prueba)
Ejecuta el request: `7. Seed > 7.1 Ejecutar Seed`

Esto crea:
- Un usuario admin: `user@gmail.com` / `123Abc`
- Varios productos de prueba

### Paso 3: Login
Ejecuta: `1. Auth > 1.1 Login Usuario (Seed)`

El token se guarda automáticamente en las variables de la colección.

### Paso 4: Probar el flujo completo

1. **Listar Productos** - Ver productos disponibles
2. **Agregar al Carrito** - Añadir productos
3. **Crear Orden** - Generar una orden desde el carrito
4. **Procesar Pago** - Pagar con Culqi, MercadoPago o Stripe

## Endpoints Disponibles

### Auth
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/login` | Login con email/password |
| GET | `/auth/check-auth-status` | Verificar token válido |
| GET | `/auth/private` | Test ruta protegida |

### Products
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/products` | Listar productos (paginado) |
| GET | `/products/:term` | Buscar por ID o slug |
| POST | `/products` | Crear producto (Admin) |
| PATCH | `/products/:id` | Actualizar producto (Admin) |
| DELETE | `/products/:id` | Eliminar producto (Admin) |

### Cart
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/cart` | Ver mi carrito |
| POST | `/cart/items` | Agregar item |
| PATCH | `/cart/items/:id` | Actualizar cantidad |
| DELETE | `/cart/items/:id` | Eliminar item |
| DELETE | `/cart` | Vaciar carrito |
| GET | `/cart/checkout` | Resumen para checkout |

### Orders
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/orders` | Crear orden |
| GET | `/orders` | Mis órdenes |
| GET | `/orders/:id` | Ver orden específica |
| GET | `/orders/admin/all` | Todas las órdenes (Admin) |
| PATCH | `/orders/:id/status` | Cambiar estado (Admin) |
| PATCH | `/orders/:id/cancel` | Cancelar orden |

### Payments
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/payments` | Procesar pago |
| GET | `/payments` | Mis pagos |
| GET | `/payments/admin/all` | Todos los pagos (Admin) |
| GET | `/payments/:id` | Ver pago específico |
| GET | `/payments/order/:orderId` | Pagos de una orden |
| POST | `/payments/:id/refund` | Reembolsar (Admin) |

### Webhooks (para proveedores de pago)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/payments/webhooks/culqi` | Webhook Culqi |
| POST | `/payments/webhooks/mercadopago` | Webhook MercadoPago |
| POST | `/payments/webhooks/stripe` | Webhook Stripe |

## Tokens de Prueba

### Culqi (Sandbox)
```
Token: tkn_test_xxxxxxxx
```
Ver más en: https://docs.culqi.com/#/desarrollo/tarjetas-de-prueba

### MercadoPago (Sandbox)
```
Token: TEST-xxxx-xxxx-xxxx
```
Ver más en: https://www.mercadopago.com.pe/developers/es/docs/checkout-api/integration-test/test-cards

### Stripe (Test Mode)
```
Token: pm_card_visa
```
Ver más en: https://stripe.com/docs/testing

## Variables de Colección

Las siguientes variables se guardan automáticamente al ejecutar los requests:

| Variable | Descripción |
|----------|-------------|
| `token` | JWT del usuario actual |
| `adminToken` | JWT del admin |
| `productId` | ID del último producto |
| `cartItemId` | ID del último item del carrito |
| `orderId` | ID de la última orden creada |
| `paymentId` | ID del último pago procesado |

## Notas

- Los webhooks en la carpeta "6. Webhooks" son para simular las notificaciones que envían los proveedores de pago
- En producción, estos endpoints son llamados automáticamente por Culqi, MercadoPago o Stripe
- Asegúrate de tener PostgreSQL corriendo antes de iniciar el servidor
