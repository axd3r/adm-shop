# ADM-SHOP E-COMMERCE BACKEND

## Estado Actual
- NestJS + TypeScript + TypeORM + PostgreSQL
- Auth JWT + WebSockets + Docker + Swagger
- Usuarios con roles (admin, superUser, user)
- Productos con imagenes
- Carrito persistente
- Sistema de pedidos con estados
- Pagos multi-gateway (Culqi, MercadoPago, Stripe)
- Notificaciones (Email + WebSocket)

## Stack
- Backend: NestJS, TypeORM, PostgreSQL
- Auth: Passport JWT + Guards + Decorators
- Pagos: Culqi, MercadoPago, Stripe
- Notificaciones: Nodemailer + WebSocket Gateway
- Testing: Jest + Supertest
- Deploy: Railway (pendiente), GitHub Actions (pendiente)

## Estructura de Modulos
```
src/
├── auth/           # JWT, guards, decorators ✅
├── modules/
│   ├── users/      # CRUD usuarios + roles ✅
│   ├── products/   # Catalogo + imagenes ✅
│   ├── cart/       # Carrito persistente ✅
│   ├── orders/     # Pedidos + estados ✅
│   ├── payments/   # Multi-gateway + webhooks ✅
│   └── notifications/ # Email + WebSocket push ✅
├── storage/files/  # Upload de archivos ✅
├── messages-ws/    # Chat WebSocket ✅
├── seed/           # Data inicial ✅
└── common/         # Helpers, DTOs ✅
```

## Modulos Implementados

### Auth
- JWT authentication
- Guards (RoleGuard)
- Decorators (@Auth, @GetUser, @RoleProtected)
- Roles: admin, superUser, user

### Cart
- Carrito por usuario (persistente en DB)
- Add/Update/Remove items
- Validacion de stock
- Calculo de totales + IGV 18%

### Orders
- Estados: PENDING, CONFIRMED, PAID, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED
- Transiciones validadas
- Historial por usuario
- Vista admin (findAllAdmin)

### Payments
- Providers: Culqi, MercadoPago, Stripe
- Webhooks para cada gateway
- Estados: PENDING, COMPLETED, FAILED, REFUNDED
- Tests unitarios (6 archivos)

### Notifications
- EmailService con templates HTML
- PushService para WebSocket
- NotificationsGateway
- Templates: payment_success, payment_failed, payment_refunded

## Testing (222 tests - 75% coverage) ✅
```
src/
├── app.controller.spec.ts ✅
├── auth/__tests__/
│   ├── auth.service.spec.ts ✅
│   └── auth.controller.spec.ts ✅
├── messages-ws/__tests__/
│   ├── messages-ws.service.spec.ts ✅
│   └── messages-ws.gateway.spec.ts ✅
├── modules/cart/__tests__/
│   ├── cart.service.spec.ts ✅
│   └── cart.controller.spec.ts ✅
├── modules/orders/__tests__/
│   ├── orders.service.spec.ts ✅
│   └── orders.controller.spec.ts ✅
├── modules/users/__tests__/
│   ├── users.service.spec.ts ✅
│   └── users.controller.spec.ts ✅
├── modules/payments/__tests__/
│   ├── culqi.service.spec.ts ✅
│   ├── mercadopago.service.spec.ts ✅
│   ├── stripe.service.spec.ts ✅
│   ├── payments.controller.spec.ts ✅
│   ├── payments.service.spec.ts ✅
│   └── webhooks.service.spec.ts ✅
├── modules/notifications/__tests__/
│   ├── push.service.spec.ts ✅
│   ├── email.service.spec.ts ✅
│   └── notifications.gateway.spec.ts ✅
├── modules/products/
│   ├── products.service.spec.ts ✅
│   └── products.controller.spec.ts ✅
├── storage/files/__tests__/
│   ├── files.service.spec.ts ✅
│   └── files.controller.spec.ts ✅
└── seed/__tests__/
    ├── seed.service.spec.ts ✅
    └── seed.controller.spec.ts ✅
```

## Pendiente

### Alta Prioridad
1. **Rol vendedor** - Agregar role `seller` para vendedores
2. **CI/CD** - GitHub Actions para tests + deploy

### Media Prioridad
4. **Analytics** - Dashboard de metricas de ventas
5. **AWS S3** - Subir imagenes a S3 en vez de local
6. **Deploy** - Railway + Sentry monitoring

### Baja Prioridad
7. **README** - Documentacion con arquitectura
8. **Postman** - Collection completa (existe carpeta postman/)
9. **Redis** - Cache + Bull queues

## Comandos
```bash
npm run start:dev    # Desarrollo
npm run test         # Unit tests
npm run test:cov     # Coverage
npm run build        # Build produccion
```

## Recursos
- Culqi: https://docs.culqi.com/
- Stripe: https://stripe.com/docs
- MercadoPago: https://www.mercadopago.com.pe/developers/
- NestJS: https://docs.nestjs.com/
