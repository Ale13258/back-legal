-- Deudores aislados por conjunto (cliente_id).
-- Documentos placeholder (1234567890, 111111111, etc.) no se comparten entre unidades.

ALTER TABLE "deudores" ADD COLUMN "cliente_id" TEXT;

-- Hay que soltar la unicidad global ANTES de clonar el mismo documento en otro conjunto.
DROP INDEX IF EXISTS "deudores_documento_key";

-- 1) Asignar cliente_id desde alguna cuenta vinculada.
UPDATE "deudores" d
SET "cliente_id" = sub."cliente_id"
FROM (
  SELECT DISTINCT ON (cd."deudor_id")
    cd."deudor_id",
    cu."cliente_id"
  FROM "cuenta_deudores" cd
  INNER JOIN "cuentas" cu ON cu."id" = cd."cuenta_id"
  ORDER BY cd."deudor_id", cu."cliente_id"
) sub
WHERE d."id" = sub."deudor_id";

-- 2) Un deudor usado por varios conjuntos: clonar uno por cliente extra y retargetear vínculos.
CREATE TEMP TABLE tmp_deudor_cliente_clone (
  old_id TEXT NOT NULL,
  cliente_id TEXT NOT NULL,
  new_id TEXT NOT NULL
);

INSERT INTO tmp_deudor_cliente_clone (old_id, cliente_id, new_id)
SELECT DISTINCT
  d."id",
  cu."cliente_id",
  gen_random_uuid()::text
FROM "cuenta_deudores" cd
INNER JOIN "deudores" d ON d."id" = cd."deudor_id"
INNER JOIN "cuentas" cu ON cu."id" = cd."cuenta_id"
WHERE d."cliente_id" IS NOT NULL
  AND cu."cliente_id" IS DISTINCT FROM d."cliente_id";

INSERT INTO "deudores" (
  "id", "cliente_id", "nombre", "tipo_persona", "documento", "emails", "telefono", "created_at", "updated_at"
)
SELECT
  t.new_id,
  t.cliente_id,
  d."nombre",
  d."tipo_persona",
  d."documento",
  d."emails",
  d."telefono",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM tmp_deudor_cliente_clone t
INNER JOIN "deudores" d ON d."id" = t.old_id;

UPDATE "cuenta_deudores" cd
SET "deudor_id" = t.new_id
FROM "cuentas" cu, tmp_deudor_cliente_clone t
WHERE cd."cuenta_id" = cu."id"
  AND t.cliente_id = cu."cliente_id"
  AND t.old_id = cd."deudor_id";

DROP TABLE tmp_deudor_cliente_clone;

-- 3) Placeholders compartidos entre unidades del mismo conjunto: un deudor por cuenta.
CREATE TEMP TABLE tmp_placeholder_split (
  cuenta_id TEXT NOT NULL,
  old_deudor_id TEXT NOT NULL,
  new_deudor_id TEXT NOT NULL
);

INSERT INTO tmp_placeholder_split (cuenta_id, old_deudor_id, new_deudor_id)
SELECT
  ranked."cuenta_id",
  ranked."deudor_id",
  gen_random_uuid()::text
FROM (
  SELECT
    cd."cuenta_id",
    cd."deudor_id",
    regexp_replace(d."documento", '[^0-9]', '', 'g') AS digits,
    ROW_NUMBER() OVER (PARTITION BY cd."deudor_id" ORDER BY cd."cuenta_id") AS rn
  FROM "cuenta_deudores" cd
  INNER JOIN "deudores" d ON d."id" = cd."deudor_id"
) ranked
WHERE ranked.rn > 1
  AND (
    length(ranked.digits) < 6
    OR ranked.digits ~ '^([0-9])\1+$'
    OR ranked.digits IN ('1234567890', '0123456789', '123456789', '9876543210', '987654321')
  );

INSERT INTO "deudores" (
  "id", "cliente_id", "nombre", "tipo_persona", "documento", "emails", "telefono", "created_at", "updated_at"
)
SELECT
  t.new_deudor_id,
  cu."cliente_id",
  COALESCE(NULLIF(btrim(cu."cobro_nombre"), ''), d."nombre"),
  cu."cobro_tipo_persona",
  COALESCE(NULLIF(btrim(cu."cobro_documento"), ''), d."documento"),
  CASE
    WHEN cu."cobro_email" IS NOT NULL AND btrim(cu."cobro_email") <> '' THEN ARRAY[btrim(cu."cobro_email")]
    ELSE ARRAY[]::text[]
  END,
  d."telefono",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM tmp_placeholder_split t
INNER JOIN "cuentas" cu ON cu."id" = t.cuenta_id
INNER JOIN "deudores" d ON d."id" = t.old_deudor_id;

UPDATE "cuenta_deudores" cd
SET "deudor_id" = t.new_deudor_id
FROM tmp_placeholder_split t
WHERE cd."cuenta_id" = t.cuenta_id
  AND cd."deudor_id" = t.old_deudor_id;

DROP TABLE tmp_placeholder_split;

-- 4) El deudor placeholder que se conservó toma nombre/correo de SU unidad.
UPDATE "deudores" d
SET
  "nombre" = COALESCE(NULLIF(btrim(cu."cobro_nombre"), ''), d."nombre"),
  "tipo_persona" = cu."cobro_tipo_persona",
  "documento" = COALESCE(NULLIF(btrim(cu."cobro_documento"), ''), d."documento"),
  "emails" = CASE
    WHEN cu."cobro_email" IS NOT NULL AND btrim(cu."cobro_email") <> '' THEN ARRAY[btrim(cu."cobro_email")]
    ELSE ARRAY[]::text[]
  END,
  "updated_at" = CURRENT_TIMESTAMP
FROM "cuenta_deudores" cd
INNER JOIN "cuentas" cu ON cu."id" = cd."cuenta_id"
WHERE cd."deudor_id" = d."id"
  AND (
    length(regexp_replace(d."documento", '[^0-9]', '', 'g')) < 6
    OR regexp_replace(d."documento", '[^0-9]', '', 'g') ~ '^([0-9])\1+$'
    OR regexp_replace(d."documento", '[^0-9]', '', 'g') IN (
      '1234567890', '0123456789', '123456789', '9876543210', '987654321'
    )
  )
  AND (
    SELECT COUNT(*) FROM "cuenta_deudores" x WHERE x."deudor_id" = d."id"
  ) = 1;

-- 5) Huérfanos sin vínculos.
DELETE FROM "deudores" d
WHERE NOT EXISTS (
  SELECT 1 FROM "cuenta_deudores" cd WHERE cd."deudor_id" = d."id"
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "deudores" WHERE "cliente_id" IS NULL) THEN
    RAISE EXCEPTION 'deudores.cliente_id quedó nulo tras el backfill';
  END IF;
END $$;

ALTER TABLE "deudores" ALTER COLUMN "cliente_id" SET NOT NULL;

ALTER TABLE "deudores"
  ADD CONSTRAINT "deudores_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_deudores_cliente_id" ON "deudores"("cliente_id");
CREATE INDEX "idx_deudores_cliente_documento" ON "deudores"("cliente_id", "documento");
