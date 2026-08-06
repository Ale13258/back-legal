-- Simplificar: evento + descripcion en gestiones; sin tabla de correos ni detalles.

ALTER TABLE "gestiones" ADD COLUMN "estado" TEXT;
ALTER TABLE "gestiones" ADD COLUMN "descripcion" TEXT;

-- Manuales: copiar detalle tal cual
UPDATE "gestiones" AS g
SET
  "estado" = d."estado",
  "descripcion" = d."descripcion"
FROM "gestion_detalles" AS d
WHERE d."gestion_id" = g."id"
  AND g."tipo" = 'manual';

-- Correos: meter info + cuerpo en descripcion (JSON)
UPDATE "gestiones" AS g
SET
  "estado" = COALESCE(d."estado", 'enviado'),
  "descripcion" = CASE
    WHEN e."id" IS NOT NULL THEN json_build_object(
      'summary', d."descripcion",
      'subject', e."subject",
      'cliente_email', e."cliente_email",
      'extra_recipients', COALESCE(to_jsonb(e."extra_recipients"), '[]'::jsonb),
      'body_html', e."body_html",
      'body_text', e."body_text",
      'provider_id', e."provider_id",
      'status', e."status",
      'sent_at', e."sent_at"
    )::text
    ELSE COALESCE(d."descripcion", '')
  END
FROM "gestion_detalles" AS d
LEFT JOIN "payment_reminder_emails" AS e ON e."id" = d."email_reminder_id"
WHERE d."gestion_id" = g."id"
  AND g."tipo" = 'email_reminder';

-- Fallback por si quedó algo sin detalle
UPDATE "gestiones"
SET
  "estado" = COALESCE("estado", 'pendiente'),
  "descripcion" = COALESCE("descripcion", '')
WHERE "estado" IS NULL OR "descripcion" IS NULL;

ALTER TABLE "gestiones" ALTER COLUMN "estado" SET NOT NULL;
ALTER TABLE "gestiones" ALTER COLUMN "descripcion" SET NOT NULL;

-- Quitar detalle y tabla de correos
ALTER TABLE "gestion_detalles" DROP CONSTRAINT IF EXISTS "gestion_detalles_email_reminder_id_fkey";
ALTER TABLE "gestion_detalles" DROP CONSTRAINT IF EXISTS "gestion_detalles_gestion_id_fkey";
DROP TABLE IF EXISTS "gestion_detalles";
DROP TABLE IF EXISTS "payment_reminder_emails";
