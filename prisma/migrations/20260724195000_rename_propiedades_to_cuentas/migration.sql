-- Rename: propiedades → cuentas (cartera)
--         cuentas → procesos_legales
--         propiedad_deudores → cuenta_deudores
-- Enums:  tipo_cuenta_enum (legal) → tipo_proceso_legal_enum
--         estado_cuenta_enum → estado_proceso_legal_enum
--         tipo_propiedad_enum → tipo_cuenta_enum

-- 1) Liberar nombres de enums legales
ALTER TYPE "tipo_cuenta_enum" RENAME TO "tipo_proceso_legal_enum";
ALTER TYPE "estado_cuenta_enum" RENAME TO "estado_proceso_legal_enum";

-- 2) Enum de cartera (ex tipo_propiedad)
ALTER TYPE "tipo_propiedad_enum" RENAME TO "tipo_cuenta_enum";

-- 3) Liberar tabla "cuentas" → procesos_legales
ALTER TABLE "cuentas" RENAME TO "procesos_legales";
ALTER INDEX IF EXISTS "cuentas_pkey" RENAME TO "procesos_legales_pkey";
ALTER INDEX IF EXISTS "cuentas_numero_cuenta_key" RENAME TO "procesos_legales_numero_cuenta_key";
ALTER INDEX IF EXISTS "idx_cuentas_cliente_id" RENAME TO "idx_procesos_legales_cliente_id";
ALTER INDEX IF EXISTS "idx_cuentas_deleted_at" RENAME TO "idx_procesos_legales_deleted_at";
ALTER TABLE "procesos_legales" RENAME CONSTRAINT "cuentas_cliente_id_fkey" TO "procesos_legales_cliente_id_fkey";
ALTER TABLE "procesos_legales" RENAME CONSTRAINT "cuentas_propiedad_id_fkey" TO "procesos_legales_propiedad_id_fkey";

-- 4) propiedades → cuentas
ALTER TABLE "propiedades" RENAME TO "cuentas";
ALTER INDEX IF EXISTS "propiedades_pkey" RENAME TO "cuentas_pkey";
ALTER INDEX IF EXISTS "idx_propiedades_cliente_id" RENAME TO "idx_cuentas_cliente_id";
ALTER TABLE "cuentas" RENAME CONSTRAINT "propiedades_cliente_id_fkey" TO "cuentas_cliente_id_fkey";
ALTER TABLE "cuentas" RENAME CONSTRAINT "chk_propiedades_cobro_agg_fechas" TO "chk_cuentas_cobro_agg_fechas";
ALTER TABLE "cuentas" RENAME COLUMN "tipo_propiedad" TO "tipo_cuenta";

-- 5) FKs propiedad_id → cuenta_id
ALTER TABLE "procesos_legales" RENAME COLUMN "propiedad_id" TO "cuenta_id";
ALTER TABLE "procesos_legales" RENAME CONSTRAINT "procesos_legales_propiedad_id_fkey" TO "procesos_legales_cuenta_id_fkey";

ALTER TABLE "historial_pagos" RENAME COLUMN "propiedad_id" TO "cuenta_id";
ALTER INDEX IF EXISTS "idx_historial_propiedad_periodo" RENAME TO "idx_historial_cuenta_periodo";
ALTER TABLE "historial_pagos" RENAME CONSTRAINT "historial_pagos_propiedad_id_fkey" TO "historial_pagos_cuenta_id_fkey";

ALTER TABLE "gestiones" RENAME COLUMN "propiedad_id" TO "cuenta_id";
ALTER INDEX IF EXISTS "gestiones_propiedad_id_fecha_idx" RENAME TO "gestiones_cuenta_id_fecha_idx";
ALTER TABLE "gestiones" RENAME CONSTRAINT "gestiones_propiedad_id_fkey" TO "gestiones_cuenta_id_fkey";

ALTER TABLE "payment_reminder_emails" RENAME COLUMN "propiedad_id" TO "cuenta_id";
ALTER INDEX IF EXISTS "idx_payment_reminder_emails_propiedad_created" RENAME TO "idx_payment_reminder_emails_cuenta_created";
ALTER TABLE "payment_reminder_emails" RENAME CONSTRAINT "payment_reminder_emails_propiedad_id_fkey" TO "payment_reminder_emails_cuenta_id_fkey";

-- 6) intermedia
ALTER TABLE "propiedad_deudores" RENAME TO "cuenta_deudores";
ALTER TABLE "cuenta_deudores" RENAME COLUMN "propiedad_id" TO "cuenta_id";
ALTER TABLE "cuenta_deudores" RENAME CONSTRAINT "propiedad_deudores_pkey" TO "cuenta_deudores_pkey";
ALTER TABLE "cuenta_deudores" RENAME CONSTRAINT "propiedad_deudores_propiedad_id_fkey" TO "cuenta_deudores_cuenta_id_fkey";
ALTER TABLE "cuenta_deudores" RENAME CONSTRAINT "propiedad_deudores_deudor_id_fkey" TO "cuenta_deudores_deudor_id_fkey";
