-- Fase 1–2: creditors + creditor_id nullable en cuentas (compat API con cliente_id).

CREATE TABLE IF NOT EXISTS "creditors" (
  "id" TEXT NOT NULL,
  "cliente_id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "tipo_persona" "tipo_persona_enum" NOT NULL,
  "documento" TEXT NOT NULL,
  "telefono" TEXT,
  "email" TEXT,
  "direccion" TEXT,
  "observaciones" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "creditors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "creditors_cliente_documento_key"
  ON "creditors"("cliente_id", "documento");

CREATE INDEX IF NOT EXISTS "idx_creditors_cliente_id"
  ON "creditors"("cliente_id");

ALTER TABLE "creditors"
  DROP CONSTRAINT IF EXISTS "creditors_cliente_id_fkey";

ALTER TABLE "creditors"
  ADD CONSTRAINT "creditors_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cuentas"
  ADD COLUMN IF NOT EXISTS "creditor_id" TEXT;

CREATE INDEX IF NOT EXISTS "idx_cuentas_creditor_id"
  ON "cuentas"("creditor_id");

ALTER TABLE "cuentas"
  DROP CONSTRAINT IF EXISTS "cuentas_creditor_id_fkey";

ALTER TABLE "cuentas"
  ADD CONSTRAINT "cuentas_creditor_id_fkey"
  FOREIGN KEY ("creditor_id") REFERENCES "creditors"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant LegalTech (defaults Fase 1–2).
INSERT INTO "clientes" (
  "id", "nombre", "tipo_persona", "documento", "telefono", "email",
  "direccion", "observaciones", "is_active", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  'LegalTech',
  'juridica'::"tipo_persona_enum",
  '900000000-0',
  NULL,
  'tenant@legaltech.com',
  NULL,
  'Tenant SaaS raíz (Fase 1–2)',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "clientes" WHERE lower("email") = lower('tenant@legaltech.com')
)
AND NOT EXISTS (
  SELECT 1 FROM "clientes" WHERE "documento" = '900000000-0'
);

-- Acreedores espejo bajo LegalTech para cada cliente de cartera existente.
INSERT INTO "creditors" (
  "id", "cliente_id", "nombre", "tipo_persona", "documento", "telefono", "email",
  "direccion", "observaciones", "is_active", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  lt."id",
  c."nombre",
  c."tipo_persona",
  c."documento",
  c."telefono",
  c."email",
  c."direccion",
  c."observaciones",
  c."is_active",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "clientes" c
CROSS JOIN (
  SELECT "id" FROM "clientes" WHERE "documento" = '900000000-0' LIMIT 1
) lt
WHERE c."documento" <> '900000000-0'
  AND NOT EXISTS (
    SELECT 1 FROM "creditors" cr
    WHERE cr."cliente_id" = lt."id" AND cr."documento" = c."documento"
  );

-- Backfill creditor_id en cuentas (match por documento del cliente legacy bajo LegalTech).
UPDATE "cuentas" cu
SET "creditor_id" = cr."id"
FROM "clientes" c
JOIN "creditors" cr ON cr."documento" = c."documento"
JOIN "clientes" lt ON lt."id" = cr."cliente_id" AND lt."documento" = '900000000-0'
WHERE cu."cliente_id" = c."id"
  AND cu."creditor_id" IS NULL
  AND c."documento" <> '900000000-0';
