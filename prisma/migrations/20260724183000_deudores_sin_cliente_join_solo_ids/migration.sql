-- Deudor ya no pertenece al Cliente; la intermedia solo guarda los dos ids.

-- 1) Quitar cliente_id de deudores (unicidad pasa a documento global)
ALTER TABLE "deudores" DROP CONSTRAINT IF EXISTS "deudores_cliente_id_fkey";
DROP INDEX IF EXISTS "uq_deudores_cliente_documento";
DROP INDEX IF EXISTS "idx_deudores_cliente_id";
ALTER TABLE "deudores" DROP COLUMN "cliente_id";
CREATE UNIQUE INDEX "deudores_documento_key" ON "deudores"("documento");

-- 2) propiedad_deudores: solo propiedad_id + deudor_id
DROP INDEX IF EXISTS "idx_propiedad_deudores_propiedad_orden";
DROP INDEX IF EXISTS "uq_propiedad_deudores_pair";

ALTER TABLE "propiedad_deudores" DROP CONSTRAINT IF EXISTS "propiedad_deudores_pkey";
ALTER TABLE "propiedad_deudores" DROP COLUMN IF EXISTS "id";
ALTER TABLE "propiedad_deudores" DROP COLUMN IF EXISTS "orden";

ALTER TABLE "propiedad_deudores"
  ADD CONSTRAINT "propiedad_deudores_pkey" PRIMARY KEY ("propiedad_id", "deudor_id");
