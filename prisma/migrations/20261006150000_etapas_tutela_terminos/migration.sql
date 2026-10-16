-- Nuevas etapas de tutela con término por etapa.
ALTER TYPE "etapa_tutela_enum" RENAME TO "etapa_tutela_enum_old";

CREATE TYPE "etapa_tutela_enum" AS ENUM (
  'radicacion',
  'admision',
  'inadmision',
  'requerimiento',
  'sentencia',
  'impugnacion',
  'desacato',
  'admite_impugnacion',
  'otro',
  'finalizada'
);

ALTER TABLE "tutelas" ALTER COLUMN "etapa" DROP DEFAULT;

ALTER TABLE "tutelas" ALTER COLUMN "etapa" TYPE "etapa_tutela_enum" USING (
  CASE "etapa"::text
    WHEN 'radicada' THEN 'radicacion'
    WHEN 'admitida' THEN 'admision'
    WHEN 'requiere_informe' THEN 'requerimiento'
    WHEN 'fallo' THEN 'sentencia'
    WHEN 'impugnada' THEN 'impugnacion'
    WHEN 'incidente' THEN 'desacato'
    WHEN 'archivada' THEN 'finalizada'
    ELSE "etapa"::text
  END
)::"etapa_tutela_enum";

ALTER TABLE "tutelas" ALTER COLUMN "etapa" SET DEFAULT 'radicacion';

DROP TYPE "etapa_tutela_enum_old";

-- Día en que la tutela entró a la etapa actual.
ALTER TABLE "tutelas" ADD COLUMN "fecha_etapa" DATE;

UPDATE "tutelas" SET "fecha_etapa" = "fecha_radicacion" WHERE "etapa" = 'radicacion';
