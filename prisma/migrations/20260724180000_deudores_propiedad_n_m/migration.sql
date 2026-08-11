-- Deudores normalizados (N:M con propiedades vía propiedad_deudores).
-- Cliente = dueño de la cartera; Deudor = a quien se cobra.

CREATE TABLE "deudores" (
  "id" TEXT NOT NULL,
  "cliente_id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "tipo_persona" "tipo_persona_enum" NOT NULL,
  "documento" TEXT NOT NULL,
  "emails" TEXT[] NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deudores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_deudores_cliente_documento"
  ON "deudores"("cliente_id", "documento");

CREATE INDEX "idx_deudores_cliente_id" ON "deudores"("cliente_id");

ALTER TABLE "deudores"
  ADD CONSTRAINT "deudores_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "propiedad_deudores" (
  "id" TEXT NOT NULL,
  "propiedad_id" TEXT NOT NULL,
  "deudor_id" TEXT NOT NULL,
  "orden" INTEGER NOT NULL,
  CONSTRAINT "propiedad_deudores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_propiedad_deudores_pair"
  ON "propiedad_deudores"("propiedad_id", "deudor_id");

CREATE INDEX "idx_propiedad_deudores_propiedad_orden"
  ON "propiedad_deudores"("propiedad_id", "orden");

ALTER TABLE "propiedad_deudores"
  ADD CONSTRAINT "propiedad_deudores_propiedad_id_fkey"
  FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "propiedad_deudores"
  ADD CONSTRAINT "propiedad_deudores_deudor_id_fkey"
  FOREIGN KEY ("deudor_id") REFERENCES "deudores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill desde JSON propiedades.deudores (soporta emails[] o email legacy)
WITH expanded AS (
  SELECT
    p.id AS propiedad_id,
    p.cliente_id,
    (t.ord - 1)::int AS orden,
    trim(both FROM COALESCE(t.elem->>'nombre', '')) AS nombre,
    (t.elem->>'tipo_persona')::"tipo_persona_enum" AS tipo_persona,
    trim(both FROM COALESCE(t.elem->>'documento', '')) AS documento,
    CASE
      WHEN jsonb_typeof(t.elem->'emails') = 'array' THEN
        ARRAY(
          SELECT trim(both FROM e)
          FROM jsonb_array_elements_text(t.elem->'emails') AS e
          WHERE trim(both FROM e) <> ''
        )
      WHEN COALESCE(trim(both FROM t.elem->>'email'), '') <> '' THEN
        ARRAY[trim(both FROM t.elem->>'email')]
      ELSE
        ARRAY[]::text[]
    END AS emails
  FROM "propiedades" p
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(p."deudores") = 'array' AND jsonb_array_length(p."deudores") > 0
        THEN p."deudores"
      ELSE jsonb_build_array(
        jsonb_build_object(
          'nombre', p."cobro_nombre",
          'tipo_persona', p."cobro_tipo_persona"::text,
          'documento', p."cobro_documento",
          'emails', jsonb_build_array(p."cobro_email")
        )
      )
    END
  ) WITH ORDINALITY AS t(elem, ord)
  WHERE trim(both FROM COALESCE(t.elem->>'documento', p."cobro_documento", '')) <> ''
),
dedup_deudores AS (
  SELECT DISTINCT ON (cliente_id, documento)
    cliente_id,
    nombre,
    tipo_persona,
    documento,
    emails
  FROM expanded
  ORDER BY cliente_id, documento, orden ASC
),
inserted_deudores AS (
  INSERT INTO "deudores" ("id", "cliente_id", "nombre", "tipo_persona", "documento", "emails", "created_at", "updated_at")
  SELECT
    gen_random_uuid()::text,
    d.cliente_id,
    d.nombre,
    d.tipo_persona,
    d.documento,
    d.emails,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM dedup_deudores d
  RETURNING "id", "cliente_id", "documento"
),
link_rows AS (
  SELECT DISTINCT ON (e.propiedad_id, e.documento)
    e.propiedad_id,
    e.cliente_id,
    e.documento,
    e.orden
  FROM expanded e
  ORDER BY e.propiedad_id, e.documento, e.orden ASC
)
INSERT INTO "propiedad_deudores" ("id", "propiedad_id", "deudor_id", "orden")
SELECT
  gen_random_uuid()::text,
  l.propiedad_id,
  d.id,
  l.orden
FROM link_rows l
INNER JOIN inserted_deudores d
  ON d.cliente_id = l.cliente_id
 AND d.documento = l.documento;

-- Ya no se usa el JSON embebido
ALTER TABLE "propiedades" DROP COLUMN "deudores";
