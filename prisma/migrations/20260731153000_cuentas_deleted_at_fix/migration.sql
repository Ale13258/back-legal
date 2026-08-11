-- Fix: soft-delete de cartera. La migración 20260724190000 añadió deleted_at a la
-- antigua tabla "cuentas" (ahora procesos_legales). Tras el rename, la cartera
-- (ex propiedades → cuentas) quedó sin la columna.

ALTER TABLE "cuentas" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "idx_cuentas_deleted_at" ON "cuentas"("deleted_at");
