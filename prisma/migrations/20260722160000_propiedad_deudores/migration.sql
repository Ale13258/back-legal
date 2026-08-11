-- Multi-deudor por propiedad (JSON). cobro_* sigue siendo proyección de deudores[0].
ALTER TABLE "propiedades" ADD COLUMN "deudores" JSONB;

UPDATE "propiedades"
SET "deudores" = jsonb_build_array(
  jsonb_build_object(
    'nombre', "cobro_nombre",
    'tipo_persona', "cobro_tipo_persona"::text,
    'documento', "cobro_documento",
    'email', "cobro_email"
  )
);

ALTER TABLE "propiedades" ALTER COLUMN "deudores" SET NOT NULL;
