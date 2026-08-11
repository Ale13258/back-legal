-- Procesos legales cuelgan solo de la cuenta (ya no de clientes).

-- 1) Backfill exacto: numero_cuenta = identificador de cuenta
UPDATE "procesos_legales" pl
SET "cuenta_id" = c."id"
FROM "cuentas" c
WHERE pl."cuenta_id" IS NULL
  AND c."identificador" = pl."numero_cuenta"
  AND c."deleted_at" IS NULL;

-- 2) Caso conocido (dev): ALTANA T7-106 ≈ TORRE 7 APTO 106 del mismo cliente legacy
UPDATE "procesos_legales" pl
SET "cuenta_id" = c."id"
FROM "cuentas" c
WHERE pl."id" = '5cbf597b-7de8-4b9f-a7d9-0a301b059282'
  AND pl."cuenta_id" IS NULL
  AND c."identificador" = 'TORRE 7 APTO 106'
  AND c."cliente_id" = pl."cliente_id"
  AND c."deleted_at" IS NULL;

-- 3) No debe quedar ningún proceso sin cuenta
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "procesos_legales" WHERE "cuenta_id" IS NULL) THEN
    RAISE EXCEPTION 'Hay procesos_legales sin cuenta_id; vincúlalos antes de migrar';
  END IF;
END $$;

-- 4) cuenta_id obligatorio
ALTER TABLE "procesos_legales"
  ALTER COLUMN "cuenta_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_procesos_legales_cuenta_id"
  ON "procesos_legales"("cuenta_id");

-- 5) Quitar vínculo directo a clientes
ALTER TABLE "procesos_legales"
  DROP CONSTRAINT IF EXISTS "procesos_legales_cliente_id_fkey";

DROP INDEX IF EXISTS "idx_procesos_legales_cliente_id";

ALTER TABLE "procesos_legales"
  DROP COLUMN "cliente_id";
