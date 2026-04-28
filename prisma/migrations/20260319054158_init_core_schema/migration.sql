-- CreateEnum
CREATE TYPE "role_enum" AS ENUM ('admin', 'cliente');

-- CreateEnum
CREATE TYPE "tipo_persona_enum" AS ENUM ('natural', 'juridica');

-- CreateEnum
CREATE TYPE "tipo_propiedad_enum" AS ENUM ('apartamento', 'local', 'parqueadero', 'otro');

-- CreateEnum
CREATE TYPE "estado_pago_enum" AS ENUM ('pendiente', 'parcial', 'pagado', 'vencido');

-- CreateEnum
CREATE TYPE "concepto_pago_enum" AS ENUM ('administracion', 'intereses', 'extraordinaria', 'otros');

-- CreateEnum
CREATE TYPE "tipo_cuenta_enum" AS ENUM ('juridica', 'extrajudicial', 'acuerdo_de_pago');

-- CreateEnum
CREATE TYPE "estado_cuenta_enum" AS ENUM ('activa', 'cerrada', 'en_proceso');

-- CreateEnum
CREATE TYPE "etapa_proceso_enum" AS ENUM ('inicial', 'notificacion', 'conciliacion', 'demanda', 'ejecucion');

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo_persona" "tipo_persona_enum" NOT NULL,
    "documento" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT NOT NULL,
    "direccion" TEXT,
    "observaciones" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "role_enum" NOT NULL,
    "cliente_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propiedades" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "tipo_propiedad" "tipo_propiedad_enum" NOT NULL,
    "identificador" TEXT NOT NULL,
    "direccion" TEXT,
    "notas" TEXT,
    "monto_a_la_fecha" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "propiedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_pagos" (
    "id" TEXT NOT NULL,
    "propiedad_id" TEXT NOT NULL,
    "periodo" CHAR(7) NOT NULL,
    "concepto" "concepto_pago_enum" NOT NULL,
    "valor_cobrado" DECIMAL(14,2) NOT NULL,
    "valor_pagado" DECIMAL(14,2) NOT NULL,
    "fecha_pago" DATE,
    "estado_pago" "estado_pago_enum" NOT NULL,
    "monto_a_la_fecha" DECIMAL(14,2) NOT NULL,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historial_pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "propiedad_id" TEXT,
    "numero_cuenta" TEXT NOT NULL,
    "tipo" "tipo_cuenta_enum" NOT NULL,
    "estado" "estado_cuenta_enum" NOT NULL,
    "etapa_proceso" "etapa_proceso_enum" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestiones" (
    "id" TEXT NOT NULL,
    "propiedad_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gestiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_token_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_documento_key" ON "clientes"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "idx_propiedades_cliente_id" ON "propiedades"("cliente_id");

-- CreateIndex
CREATE INDEX "idx_historial_propiedad_periodo" ON "historial_pagos"("propiedad_id", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_numero_cuenta_key" ON "cuentas"("numero_cuenta");

-- CreateIndex
CREATE INDEX "idx_cuentas_cliente_id" ON "cuentas"("cliente_id");

-- CreateIndex
CREATE INDEX "gestiones_propiedad_id_fecha_idx" ON "gestiones"("propiedad_id", "fecha");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_usuario" ON "refresh_tokens"("usuario_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_pagos" ADD CONSTRAINT "historial_pagos_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas" ADD CONSTRAINT "cuentas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas" ADD CONSTRAINT "cuentas_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestiones" ADD CONSTRAINT "gestiones_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
