# Backend Blueprint: Node.js + Prisma + PostgreSQL + AWS

## 1) Resumen

Este documento define la arquitectura backend objetivo para migrar el estado actual del frontend (mocks y `localStorage`) a un backend real, escalable y mantenible.

Decisiones cerradas:

- Stack: `Node.js` + `Express` + `Prisma` + `PostgreSQL` (HTTP API sin NestJS; alternativa valida: `Fastify`).
- Arquitectura: Hexagonal pragmatica (anillo) con modulos por dominio.
- Persistencia: patron Repository (puertos en dominio, adaptadores Prisma en infraestructura).
- Infraestructura: AWS para entorno productivo.

Dominios cubiertos:

- `auth`
- `clientes`
- `propiedades`
- `historial_pagos`
- `cuentas`
- `gestiones`
- `metrics`

---

## 2) Arquitectura backend (anillo + repository)

### 2.1 Capas

- `domain`: entidades, value objects, reglas puras, puertos de repositorio.
- `application`: casos de uso, DTOs de entrada/salida, coordinacion de reglas.
- `infrastructure`: adaptadores (HTTP, Prisma, JWT, cache, storage, logging).

### 2.2 Regla de dependencias

- `domain` no depende de framework ni DB.
- `application` depende de `domain`.
- `infrastructure` depende de `application` y `domain`.
- Nunca al reves.

### 2.3 Flujo de una solicitud

`Router / handler HTTP -> UseCase -> RepositoryPort -> PrismaRepository -> PostgreSQL`

### 2.4 Node.js (Express): como encajar el anillo sin romper dependencias

Sin NestJS no hay contenedor DI del framework: la composicion se hace en un **raiz de composicion** (por ejemplo `src/app.ts` o `src/composition/register*.ts`).

Regla practica:

- `UseCase` y `RepositoryPort` viven en `domain` / `application`.
- `Router`, `middleware` (auth, validacion), `PrismaRepository` viven en `infrastructure`.
- En el arranque de la app se **instancian** adaptadores y casos de uso y se pasan a los handlers (inyeccion manual o factorias pequenas por dominio).

```ts
// Ejemplo conceptual (no es codigo del repo actual)
const clientesRepo = new ClientesPrismaRepository(prisma);
const createCliente = new CreateClienteUseCase(clientesRepo);
// router.post('/clientes', handler que llama a createCliente.execute(dto))
```

Beneficio: el caso de uso depende de `ClientesRepository` (puerto), no de Prisma; Express solo cablea rutas y middleware.

---

## 3) Estructura de carpetas recomendada

```txt
src/
  modules/
    auth/
      domain/
        entities/
        repositories/
        services/
      application/
        dto/
        use-cases/
      infrastructure/
        http/
          auth.routes.ts
        persistence/
          prisma/
            auth-prisma.repository.ts
        security/
          middleware/
          jwt.ts
      auth.register.ts

    clientes/
      domain/
        entities/
        repositories/
      application/
        dto/
        use-cases/
      infrastructure/
        http/
          clientes.routes.ts
        persistence/
          prisma/
            clientes-prisma.repository.ts
      clientes.register.ts

    propiedades/
      domain/
      application/
      infrastructure/
      propiedades.register.ts

    pagos/
      domain/
      application/
      infrastructure/
      pagos.register.ts

    cuentas/
      domain/
      application/
      infrastructure/
      cuentas.register.ts

    gestiones/
      domain/
      application/
      infrastructure/
      gestiones.register.ts

    metrics/
      application/
      infrastructure/
      metrics.register.ts

  shared/
    domain/
      errors/
      result.ts
    infrastructure/
      prisma/
        prisma.client.ts
      config/
      logger/
      cache/
      storage/
      observability/

  app.ts
  main.ts
```

Notas:

- `*.register.ts`: registra rutas de ese dominio en la instancia de `Express` (o devuelve un `Router`).
- `prisma.client.ts`: singleton del `PrismaClient` (una instancia por proceso; desconexion en shutdown).

---

## 4) Convenciones API

- Base path: `/api/v1`.
- Formato JSON: `snake_case` (alineado con modelos frontend actuales).
- Versionado: por prefijo (`v1`).
- Healthcheck publico:
  - `GET /api/v1/health` -> `{ "status": "ok" }`
- Autenticacion:
  - header `Authorization: Bearer <access_token>`
- Idempotencia (opcional, recomendado en escrituras sensibles):
  - header `Idempotency-Key: <uuid>` en `POST` de pagos/cuentas/gestiones
- Errores estandar:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Payload invalido",
  "details": {
    "field": "email"
  },
  "request_id": "uuid"
}
```

- Paginacion:
  - query params: `page`, `page_size`, `sort`, `order`.
  - respuesta: `items`, `meta`.

### 4.1 Codigos HTTP minimos

- `200` OK
- `201` Created
- `204` No Content (DELETE soft)
- `400` Payload invalido / regla de negocio
- `401` No autenticado
- `403` Autenticado pero sin permiso
- `404` Recurso no encontrado
- `409` Conflicto (unique constraint, estado invalido)
- `429` Rate limit
- `500` Error interno

### 4.2 Codigos de error sugeridos (`code`)

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `BUSINESS_RULE_VIOLATION` (ej: registro cliente sin email en cartera)
- `RATE_LIMITED`
- `INTERNAL_ERROR`

---

## 5) Catalogo de APIs (REST)

### 5.0 Matriz rapida: pantalla Angular -> endpoints

Referencias de rutas actuales en el frontend:

- `src/app/pages/login-page/login-page.ts` -> `POST /auth/login`
- `src/app/pages/registro-page/registro-page.ts` -> `POST /auth/register-cliente`
- `src/app/pages/dashboard-page/dashboard-page.ts` -> `GET /metrics/dashboard` + `GET /clientes` + `GET /cuentas` (segun filtros UI)
- `src/app/pages/nuevo-cliente-page/nuevo-cliente-page.ts` -> `POST /clientes`
- `src/app/pages/cliente-detail-page/cliente-detail-page.ts` -> `GET /clientes/:id` + `GET /clientes/:id/propiedades` + `GET /clientes/:id/cuentas` + `GET /propiedades/:id/historial` (via propiedades)
- `src/app/pages/propiedades-page/propiedades-page.ts` -> `GET /propiedades`
- `src/app/pages/propiedad-detail-page/propiedad-detail-page.ts` -> `GET /propiedades/:id` + `GET /propiedades/:id/historial` + `GET /propiedades/:id/gestiones` + `POST /propiedades/:id/historial`
- `src/app/components/agregar-registro-dialog/agregar-registro-dialog.ts` -> `POST /propiedades/:id/historial`
- `src/app/pages/graficos-page/graficos-page.ts` -> `GET /metrics/*`
- `src/app/pages/cliente-portal-page/cliente-portal-page.ts` -> `GET /clientes/:id/propiedades` + lecturas de saldo/historial por propiedad (mismo contrato, con `cliente` scope)

### 5.0.1 Reglas de autorizacion por rol (minimo viable)

- `admin`: acceso completo a lecturas/escrituras administrativas.
- `cliente`: solo lecturas (y endpoints explicitamente permitidos) sobre:
  - su `cliente_id` del JWT
  - propiedades/historial/gestiones/cuentas derivadas de ese cliente

Endpoints tipicamente `admin-only`:

- `POST/PATCH/DELETE` de `clientes`, `propiedades`, `cuentas`
- `POST` de `historial` (si la UI admin lo permite; si el portal cliente debe registrar pagos, definirlo como caso aparte)

## 5.1 Auth

- `POST /api/v1/auth/login`
  - body: `{ "email": "string", "password": "string" }`
  - 200: `{ "access_token", "refresh_token", "user": { "id", "role", "cliente_id?" } }`
- `POST /api/v1/auth/register-cliente`
  - body: `{ "email", "password", "confirm_password" }`
  - regla: el email debe existir en `clientes`.
- `POST /api/v1/auth/refresh`
  - body: `{ "refresh_token": "string" }`
- `GET /api/v1/auth/me`
  - header `Authorization: Bearer <token>`
- `POST /api/v1/auth/logout`
  - invalida refresh token (denylist o rotacion).

## 5.2 Clientes

- `GET /api/v1/clientes`
  - filtros: `search`, `tipo_persona`.
- `GET /api/v1/clientes/:id`
- `POST /api/v1/clientes`
  - body:
  ```json
  {
    "nombre": "string",
    "tipo_persona": "natural|juridica",
    "documento": "string",
    "telefono": "string",
    "email": "string",
    "direccion": "string",
    "observaciones": "string"
  }
  ```
- `PATCH /api/v1/clientes/:id`
- `DELETE /api/v1/clientes/:id` (soft delete recomendado).

## 5.3 Propiedades

- `GET /api/v1/propiedades`
  - filtros: `cliente_id`, `tipo_propiedad`, `con_saldo`.
  - cada ítem incluye agregados de mora/ventana de cobro cuando existan: `edad_mora_dias`, `fecha_inicio_cobro`, `fecha_fin_cobro` (ver §6.5.1).
- `GET /api/v1/propiedades/:id`
  - mismos campos agregados que en listado.
- `POST /api/v1/propiedades`
- `PATCH /api/v1/propiedades/:id`
- `GET /api/v1/clientes/:id/propiedades`
  - mismo shape que `GET /propiedades` (incluye agregados de mora en cada propiedad).

## 5.4 Historial de pagos

- `GET /api/v1/propiedades/:id/historial`
  - filtros: `periodo_from`, `periodo_to`, `estado_pago`.
  - cada ítem incluye `dias_en_mora` (servidor), `fecha_inicio_cobro`, `fecha_fin_cobro` (date o null).
- `POST /api/v1/propiedades/:id/historial`
  - body:
  ```json
  {
    "periodo": "YYYY-MM",
    "concepto": "administracion|intereses|extraordinaria|otros",
    "valor_cobrado": 0,
    "valor_pagado": 0,
    "fecha_pago": "YYYY-MM-DD",
    "estado_pago": "pendiente|parcial|pagado|vencido",
    "observaciones": "string",
    "fecha_inicio_cobro": "YYYY-MM-DD",
    "fecha_fin_cobro": "YYYY-MM-DD"
  }
  ```
  - `fecha_inicio_cobro` y `fecha_fin_cobro` son opcionales; pueden omitirse o enviarse como `null`. Formato `YYYY-MM-DD`. Si ambas existen, debe cumplirse `fecha_fin_cobro >= fecha_inicio_cobro`.
  - El payload debe ser **strict** (sin campos extra): si el cliente envía `dias_en_mora`, se rechaza; el servidor lo recalcula siempre (§6.5.1).
  - reglas de negocio en la misma transacción: recalcular `monto_a_la_fecha` de la propiedad, persistir `dias_en_mora`, y refrescar agregados en `propiedades` (`edad_mora_dias`, fechas de cobro agregadas).

## 5.5 Cuentas

- `GET /api/v1/clientes/:id/cuentas`
- `GET /api/v1/cuentas/:id`
- `POST /api/v1/cuentas`
- `PATCH /api/v1/cuentas/:id`

## 5.6 Gestiones

- `GET /api/v1/propiedades/:id/gestiones`
- `POST /api/v1/propiedades/:id/gestiones` (habilitar desde v1 si se requiere trazabilidad completa).

## 5.7 Metrics (dashboard y graficos)

- `GET /api/v1/metrics/dashboard`
  - total cartera, clientes activos, cuentas activas.
- `GET /api/v1/metrics/distribucion-estados`
- `GET /api/v1/metrics/evolucion-cartera?months=12`

### 5.8 Ejemplos de respuesta (referencia)

Lista paginada:

```json
{
  "items": [],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 125
  }
}
```

---

## 6) Modelo de datos PostgreSQL

## 6.1 Enums

- `tipo_persona_enum`: `natural`, `juridica`.
- `tipo_propiedad_enum`: `apartamento`, `local`, `parqueadero`, `otro`.
- `estado_pago_enum`: `pendiente`, `parcial`, `pagado`, `vencido`.
- `concepto_pago_enum`: `administracion`, `intereses`, `extraordinaria`, `otros`.
- `tipo_cuenta_enum`: `juridica`, `extrajudicial`, `acuerdo_de_pago`.
- `estado_cuenta_enum`: `activa`, `cerrada`, `en_proceso`.
- `etapa_proceso_enum`: `inicial`, `notificacion`, `conciliacion`, `demanda`, `ejecucion`.
- `role_enum`: `admin`, `cliente`.

## 6.2 Tablas principales

- `usuarios`
  - `id` (uuid pk)
  - `email` (unique)
  - `password_hash`
  - `role`
  - `cliente_id` (nullable fk a `clientes`)
  - `created_at`, `updated_at`

- `clientes`
  - `id` (uuid pk)
  - `nombre`
  - `tipo_persona`
  - `documento` (unique)
  - `telefono`
  - `email` (unique)
  - `direccion`
  - `observaciones`
  - `is_active` (bool)
  - `created_at`, `updated_at`

- `propiedades`
  - `id` (uuid pk)
  - `cliente_id` (fk)
  - `tipo_propiedad`
  - `identificador`
  - `direccion`
  - `notas`
  - `monto_a_la_fecha` (numeric(14,2), default 0)
  - `edad_mora_dias` (int nullable) — denormalizado: típicamente `MAX(dias_en_mora)` del historial de esa propiedad
  - `fecha_inicio_cobro` (date nullable) — denormalizado: típicamente `MIN(fecha_inicio_cobro)` del historial (ignorando null)
  - `fecha_fin_cobro` (date nullable) — denormalizado: típicamente `MAX(fecha_fin_cobro)` del historial (ignorando null)
  - `created_at`, `updated_at`

- `historial_pagos`
  - `id` (uuid pk)
  - `propiedad_id` (fk)
  - `periodo` (char(7))
  - `concepto`
  - `valor_cobrado` (numeric(14,2))
  - `valor_pagado` (numeric(14,2))
  - `fecha_pago` (date nullable)
  - `estado_pago`
  - `monto_a_la_fecha` (numeric(14,2))
  - `dias_en_mora` (int nullable) — calculado solo en servidor (§6.5.1)
  - `fecha_inicio_cobro`, `fecha_fin_cobro` (date nullable; si ambas existen, `fin >= inicio`)
  - `observaciones`
  - `created_at`, `updated_at`

- `cuentas`
  - `id` (uuid pk)
  - `cliente_id` (fk)
  - `propiedad_id` (fk nullable)
  - `numero_cuenta` (unique)
  - `tipo`
  - `estado`
  - `etapa_proceso`
  - `created_at`, `updated_at`

- `gestiones`
  - `id` (uuid pk)
  - `propiedad_id` (fk)
  - `fecha` (date)
  - `estado` (varchar)
  - `descripcion` (text)
  - `created_at`, `updated_at`

## 6.3 Indices recomendados

- `clientes(email)`, `clientes(documento)`.
- `propiedades(cliente_id)`.
- `historial_pagos(propiedad_id, periodo)`.
- `cuentas(cliente_id)`, `cuentas(numero_cuenta)`.
- `gestiones(propiedad_id, fecha desc)`.

## 6.4 Invariantes criticas

- `valor_cobrado >= 0` y `valor_pagado >= 0`.
- `periodo` formato `YYYY-MM`.
- `monto_a_la_fecha` calculado en backend y no confiado al cliente.
- `dias_en_mora` calculado en backend; el cliente no debe poder fijarlo via API.
- Fechas de cobro en historial y agregados en propiedad: tipo `date` (no hora); si inicio y fin están presentes, `fin >= inicio` (CHECK en BD).
- Un usuario `cliente` debe mapear a un `cliente_id` valido.

## 6.5 Estrategia recomendada para `monto_a_la_fecha` (consistencia)

Objetivo: evitar divergencias entre:

- saldo mostrado en `propiedades.monto_a_la_fecha`
- saldo derivado del historial

Regla recomendada (fuente de verdad):

1. Al crear un `historial_pagos`, calcular:
   - `saldo_nuevo = saldo_anterior + valor_cobrado - valor_pagado`
   - donde `saldo_anterior` es el `monto_a_la_fecha` del ultimo registro de historial para esa propiedad (orden por `created_at`, desempate por `id`), o si no hay historial aun, el `monto_a_la_fecha` actual de `propiedades` (p. ej. saldo inicial al crear la propiedad).
2. Persistir `historial_pagos.monto_a_la_fecha = saldo_nuevo` (campo denormalizado util para auditoria/UI).
3. Actualizar `propiedades.monto_a_la_fecha = saldo_nuevo` en la misma transaccion.

Notas:

- Si necesitas recalcular por corrupcion o migracion, usa un job offline que recompute desde cero por propiedad.
- Evita confiar en la formula del frontend (`DataService.addHistorialPago`) como contrato final; el backend debe ser autoritativo.

### 6.5.1 Regla de `dias_en_mora` (fuente de verdad)

Implementación de referencia: `src/modules/propiedades/domain/mora.ts`. La **fecha de hoy** para ítems impagos usa la fecha civil en la zona configurada por `BUSINESS_TIMEZONE` (por defecto `America/Bogota`); ver `src/modules/propiedades/domain/business-calendar.ts`.

Regla actual codificada:

1. **Inicio de mora**: día siguiente al último día del mes del `periodo` (`YYYY-MM`). Se asume que el periodo vence al cierre de ese mes calendario.
2. **Fin de mora**:
   - Si `estado_pago` es `pagado` y existe `fecha_pago`, el fin es esa fecha (componentes UTC del valor `date` almacenado).
   - Si `estado_pago` es `pagado` y no hay `fecha_pago`, se devuelve **0** días (dato incompleto).
   - Si `estado_pago` es `pendiente`, `parcial` o `vencido`, el fin es **hoy** (fecha civil en `BUSINESS_TIMEZONE`).
3. **Conteo**: días calendario **inclusivos** entre inicio y fin. Si el fin es anterior al inicio, **0** días.

Tras cada alta o baja en historial, el backend debe persistir `dias_en_mora` en la fila y refrescar en `propiedades` los agregados `edad_mora_dias`, `fecha_inicio_cobro`, `fecha_fin_cobro` (máximos/mínimos sobre el historial de esa propiedad).

Datos existentes tras migración: ejecutar `npm run db:backfill-mora` una vez para rellenar `dias_en_mora` y agregados.

## 6.6 SQL DDL base (PostgreSQL) - esqueleto ejecutable

> Ajusta nombres/tipos segun convencion del equipo. Esto es una base para `prisma migrate` equivalente.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE role_enum AS ENUM ('admin', 'cliente');
CREATE TYPE tipo_persona_enum AS ENUM ('natural', 'juridica');
CREATE TYPE tipo_propiedad_enum AS ENUM ('apartamento', 'local', 'parqueadero', 'otro');
CREATE TYPE estado_pago_enum AS ENUM ('pendiente', 'parcial', 'pagado', 'vencido');
CREATE TYPE concepto_pago_enum AS ENUM ('administracion', 'intereses', 'extraordinaria', 'otros');
CREATE TYPE tipo_cuenta_enum AS ENUM ('juridica', 'extrajudicial', 'acuerdo_de_pago');
CREATE TYPE estado_cuenta_enum AS ENUM ('activa', 'cerrada', 'en_proceso');
CREATE TYPE etapa_proceso_enum AS ENUM ('inicial', 'notificacion', 'conciliacion', 'demanda', 'ejecucion');

CREATE TABLE clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo_persona tipo_persona_enum NOT NULL,
  documento text NOT NULL UNIQUE,
  telefono text,
  email text NOT NULL UNIQUE,
  direccion text,
  observaciones text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role role_enum NOT NULL,
  cliente_id uuid NULL REFERENCES clientes(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_cliente_role_chk CHECK (
    (role = 'cliente' AND cliente_id IS NOT NULL) OR (role = 'admin')
  )
);

CREATE TABLE propiedades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  tipo_propiedad tipo_propiedad_enum NOT NULL,
  identificador text NOT NULL,
  direccion text,
  notas text,
  monto_a_la_fecha numeric(14,2) NOT NULL DEFAULT 0,
  edad_mora_dias integer NULL,
  fecha_inicio_cobro date NULL,
  fecha_fin_cobro date NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_propiedades_cobro_agg_fechas CHECK (
    fecha_inicio_cobro IS NULL OR fecha_fin_cobro IS NULL OR fecha_fin_cobro >= fecha_inicio_cobro
  )
);

CREATE INDEX idx_propiedades_cliente_id ON propiedades(cliente_id);

CREATE TABLE historial_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propiedad_id uuid NOT NULL REFERENCES propiedades(id),
  periodo char(7) NOT NULL,
  concepto concepto_pago_enum NOT NULL,
  valor_cobrado numeric(14,2) NOT NULL,
  valor_pagado numeric(14,2) NOT NULL,
  fecha_pago date,
  estado_pago estado_pago_enum NOT NULL,
  monto_a_la_fecha numeric(14,2) NOT NULL,
  dias_en_mora integer NULL,
  fecha_inicio_cobro date NULL,
  fecha_fin_cobro date NULL,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_historial_montos_nonneg CHECK (valor_cobrado >= 0 AND valor_pagado >= 0),
  CONSTRAINT chk_historial_cobro_fechas CHECK (
    fecha_inicio_cobro IS NULL OR fecha_fin_cobro IS NULL OR fecha_fin_cobro >= fecha_inicio_cobro
  )
);

CREATE INDEX idx_historial_propiedad_periodo ON historial_pagos(propiedad_id, periodo);

CREATE TABLE cuentas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  propiedad_id uuid NULL REFERENCES propiedades(id),
  numero_cuenta text NOT NULL UNIQUE,
  tipo tipo_cuenta_enum NOT NULL,
  estado estado_cuenta_enum NOT NULL,
  etapa_proceso etapa_proceso_enum NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cuentas_cliente_id ON cuentas(cliente_id);

CREATE TABLE gestiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propiedad_id uuid NOT NULL REFERENCES propiedades(id),
  fecha date NOT NULL,
  estado text NOT NULL,
  descripcion text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gestiones_propiedad_fecha ON gestiones(propiedad_id, fecha DESC);

-- Refresh tokens (rotacion + revocacion)
CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  replaced_by_token_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_usuario ON refresh_tokens(usuario_id);
```

---

## 7) Prisma (ORM recomendado)

### 7.0 Repo: base de datos `legaltech` y tablas

- Crea la base de datos vacía en PostgreSQL (una sola vez): `CREATE DATABASE legaltech;`
- Configura `DATABASE_URL` en `.env` (no versionar; usa `.env.example` como plantilla). Ejemplo local típico: `postgresql://postgres:TU_PASSWORD@localhost:5432/legaltech`
- En DBeaver: **Database** = `legaltech`, host `localhost`, puerto `5432`, usuario `postgres`.
- Las tablas del dominio se crean con migraciones Prisma en [prisma/schema.prisma](prisma/schema.prisma):
  - `clientes`, `usuarios`, `propiedades`, `historial_pagos`, `cuentas`, `gestiones`, `refresh_tokens`
  - Enums PostgreSQL con sufijo `_enum` (p. ej. `role_enum`), alineados al DDL de la sección 6.6.
- Comandos útiles:
  - `npm run db:migrate` — aplica migraciones en desarrollo (`prisma migrate dev`).
  - `npm run db:deploy` — aplica migraciones en CI/staging/prod (`prisma migrate deploy`).
  - `npm run db:studio` — inspección visual de datos.
- Tras `migrate`, existen también los **CHECK** del blueprint: rol `cliente` exige `cliente_id`; montos de historial `>= 0`; ventana de cobro `fecha_fin_cobro >= fecha_inicio_cobro` en `historial_pagos` y en agregados de `propiedades`.

Prisma es la recomendacion principal por:

- Tipado fuerte y cliente generado para TypeScript.
- Migraciones claras (`prisma migrate`).
- Curva de mantenimiento favorable para equipos full-stack JS/TS.

### 7.1 `schema.prisma` completo (alineado al dominio actual)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  admin
  cliente
}

enum TipoPersona {
  natural
  juridica
}

enum TipoPropiedad {
  apartamento
  local
  parqueadero
  otro
}

enum EstadoPago {
  pendiente
  parcial
  pagado
  vencido
}

enum ConceptoPago {
  administracion
  intereses
  extraordinaria
  otros
}

enum TipoCuenta {
  juridica
  extrajudicial
  acuerdo_de_pago
}

enum EstadoCuenta {
  activa
  cerrada
  en_proceso
}

enum EtapaProceso {
  inicial
  notificacion
  conciliacion
  demanda
  ejecucion
}

model Cliente {
  id            String        @id @default(uuid())
  nombre        String
  tipo_persona  TipoPersona
  documento     String        @unique
  telefono      String?
  email         String        @unique
  direccion     String?
  observaciones String?
  is_active     Boolean       @default(true)

  propiedades Propiedad[]
  cuentas     Cuenta[]
  usuarios    Usuario[]

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
}

model Usuario {
  id            String   @id @default(uuid())
  email         String   @unique
  password_hash String
  role          Role
  cliente_id    String?
  cliente       Cliente? @relation(fields: [cliente_id], references: [id])

  refresh_tokens RefreshToken[]

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
}

model Propiedad {
  id             String        @id @default(uuid())
  cliente_id     String
  cliente        Cliente       @relation(fields: [cliente_id], references: [id])
  tipo_propiedad TipoPropiedad
  identificador  String
  direccion      String?
  notas          String?

  // Saldo autoritativo (ver seccion 6.5)
  monto_a_la_fecha Decimal @default(0) @db.Decimal(14, 2)

  edad_mora_dias     Int?
  fecha_inicio_cobro DateTime? @db.Date
  fecha_fin_cobro    DateTime? @db.Date

  historial_pagos HistorialPago[]
  gestiones       Gestion[]
  cuentas         Cuenta[]

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
}

model HistorialPago {
  id           String       @id @default(uuid())
  propiedad_id String
  propiedad    Propiedad    @relation(fields: [propiedad_id], references: [id])

  periodo        String       @db.Char(7)
  concepto       ConceptoPago
  valor_cobrado  Decimal      @db.Decimal(14, 2)
  valor_pagado   Decimal      @db.Decimal(14, 2)
  fecha_pago     DateTime?    @db.Date
  estado_pago    EstadoPago

  // Snapshot de saldo despues de aplicar esta fila (auditoria + UI)
  monto_a_la_fecha Decimal @db.Decimal(14, 2)

  dias_en_mora       Int?
  fecha_inicio_cobro DateTime? @db.Date
  fecha_fin_cobro    DateTime? @db.Date

  observaciones String?

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
}

model Cuenta {
  id            String       @id @default(uuid())
  cliente_id    String
  cliente       Cliente      @relation(fields: [cliente_id], references: [id])
  propiedad_id  String?
  propiedad     Propiedad?   @relation(fields: [propiedad_id], references: [id])

  numero_cuenta String       @unique
  tipo          TipoCuenta
  estado        EstadoCuenta
  etapa_proceso EtapaProceso

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
}

model Gestion {
  id           String    @id @default(uuid())
  propiedad_id String
  propiedad    Propiedad @relation(fields: [propiedad_id], references: [id])

  fecha        DateTime @db.Date
  estado       String
  descripcion  String

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
}

model RefreshToken {
  id         String   @id @default(uuid())
  usuario_id String
  usuario    Usuario  @relation(fields: [usuario_id], references: [id], onDelete: Cascade)

  token_hash String
  expires_at DateTime
  revoked_at DateTime?
  replaced_by_token_id String?

  created_at DateTime @default(now())
}
```

### 7.2 Migraciones y seed

- Migraciones:
  - `npx prisma migrate dev --name init_core_schema`
  - `npx prisma migrate deploy` (staging/prod)
- Seed:
  - usuario admin inicial
  - catalogo minimo de datos de prueba
- Politica:
  - no editar manualmente migraciones aplicadas en prod
  - cambios por nuevas migraciones incrementales

---

## 8) Seguridad y acceso

- JWT access token corto (15m) + refresh token rotado (7-30d).
- Password hashing con `argon2` (preferido) o `bcrypt`.
- `RBAC`: `admin` y `cliente`.
- Regla ABAC minima: `cliente` solo consulta recursos asociados a su `cliente_id`.
- Secretos en AWS Secrets Manager, cifrado con KMS.
- CORS restringido a dominios frontend autorizados.
- Rate limiting por IP y por usuario autenticado.

---

## 9) Infraestructura AWS (produccion)

## 9.1 Componentes

- Red:
  - VPC multi-AZ.
  - Subredes publicas (ALB) y privadas (ECS/RDS/Redis).
  - NAT Gateway para egreso controlado.
- DNS/TLS:
  - Route53 para dominio de API.
  - ACM para certificado TLS en ALB.
- Compute:
  - ECS Fargate para API Node.js (contenedor Express/Fastify).
  - Auto scaling por CPU, memoria y request count.
- Base de datos:
  - RDS PostgreSQL Multi-AZ.
  - PITR activado.
- Cache:
  - ElastiCache Redis (cache de lecturas y rate-limit distribuido).
- Archivos:
  - S3 (adjuntos, reportes exportados).
- Seguridad:
  - WAF delante de ALB.
  - IAM con minimo privilegio.
  - Security Groups estrictos.
  - KMS para secretos y cifrado S3 (SSE-KMS) si aplica compliance.
- Observabilidad:
  - CloudWatch Logs/Metrics/Alarms.
  - Trazas (X-Ray u OpenTelemetry).

### 9.1.1 Security Groups (regla practica)

- ALB: permite `443` desde internet (o desde CloudFront si lo usas como borde).
- ECS tasks: permite trafico solo desde el SG del ALB en el puerto de la app (ej `3000`/`8080`).
- RDS: permite `5432` solo desde SG de ECS tasks (y bastion si existe).
- Redis: permite `6379` solo desde SG de ECS tasks.

### 9.1.2 Alarmas minimas (CloudWatch)

- ALB `5xx` rate y latencia p95.
- ECS service CPU/memoria y restarts.
- RDS: conexiones, CPU, espacio libre, lag de replica (si aplica).
- Errores de aplicacion (metrica custom por `code` de error de negocio, opcional).

## 9.2 Diagrama (Mermaid)

```mermaid
flowchart LR
  ClientApp["AngularClient"] -->|"HTTPS /api/v1"| ALB["ALB+WAF"]
  ALB --> ECSApi["ECSFargateNodeAPI"]
  ECSApi --> RDSPostgres["RDSPostgreSQLMultiAZ"]
  ECSApi --> RedisCache["ElastiCacheRedis"]
  ECSApi --> S3Storage["S3"]
  ECSApi --> Secrets["SecretsManagerKMS"]
  ECSApi --> Logs["CloudWatchLogsMetrics"]
```

## 9.3 CI/CD e IaC

- Repositorio:
  - PR checks: lint + test + build.
- Pipeline:
  1. Build imagen Docker.
  2. Push a ECR.
  3. Deploy a ECS (rolling update).
  4. Migracion `prisma migrate deploy`.
  5. Smoke tests post-deploy.
- IaC:
  - Terraform para VPC, ECS, RDS, Redis, IAM, ALB, WAF, S3.

### 9.3.1 Runbook de deploy y rollback (resumen)

- Pre-check:
  - migraciones compatibles hacia atras o plan de rollback de DB documentado
- Deploy:
  - aumentar capacidad temporalmente si hay picos
  - validar `/health` y un smoke `GET /auth/me` con token de prueba
- Rollback:
  - revertir task definition anterior en ECS
  - si hubo migracion destructiva, ejecutar plan de recuperacion (restore snapshot)

---

## 10) Checklist de adopcion desde frontend actual

1. Crear backend v1 y publicar `/api/v1/health`.
2. Implementar `auth/login` y `auth/me`.
3. Migrar pantalla de login para usar backend + interceptor JWT.
4. Exponer `clientes`, `propiedades` y `historial_pagos`.
5. Reemplazar llamadas de `DataService` por `HttpClient` por modulo.
6. Mover calculos de saldo (`monto_a_la_fecha`) al backend.
7. Exponer `metrics/dashboard` para reemplazar agregaciones en frontend.
8. Activar auditoria y trazabilidad de gestiones.
9. Habilitar observabilidad y alarmas minimas en staging.
10. Promocionar a produccion con runbook y rollback definido.

### 10.1 Notas de compatibilidad con el mock actual

- El frontend hoy usa `snake_case` en modelos (`src/app/core/models/index.ts`). Mantener el mismo shape reduce friccion.
- `AuthService` hoy valida registro de cliente contra `DataService.getClientes()`; en backend debe replicarse como regla explicita en `register-cliente`.
- `NuevoClientePage` hoy no persiste; al conectar backend, `POST /clientes` se vuelve obligatorio para cerrar el flujo.

---

## 11) Riesgos y tradeoffs

- Mayor robustez implica mayor costo inicial (infra + operacion).
- Implementar todo en una sola iteracion eleva riesgo de regresion.
- Recomendacion: fases
  - Fase 1: API core + auth + clientes/propiedades/pagos.
  - Fase 2: metrics avanzadas, archivos, optimizaciones y hardening extra.

---

## 12) Criterios de aceptacion del backend

- Todos los endpoints v1 documentados y testeados.
- Migraciones aplicables en limpio (`migrate deploy`) sin pasos manuales.
- Politicas de acceso por rol funcionando.
- Alertas criticas activas (5xx, latencia, CPU/RAM, conexiones DB).
- Backups y restauracion validados.

