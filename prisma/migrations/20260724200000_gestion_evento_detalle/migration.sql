-- Separar evento (gestiones) de información (gestion_detalles).

CREATE TYPE "tipo_gestion_enum" AS ENUM ('manual', 'email_reminder');

-- 1) Columna tipo en el evento
ALTER TABLE "gestiones" ADD COLUMN "tipo" "tipo_gestion_enum";

UPDATE "gestiones"
SET "tipo" = CASE
  WHEN "origen" = 'email_reminder' THEN 'email_reminder'::"tipo_gestion_enum"
  ELSE 'manual'::"tipo_gestion_enum"
END;

ALTER TABLE "gestiones" ALTER COLUMN "tipo" SET NOT NULL;

-- 2) Tabla de detalle
CREATE TABLE "gestion_detalles" (
  "id" TEXT NOT NULL,
  "gestion_id" TEXT NOT NULL,
  "estado" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL,
  "email_reminder_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gestion_detalles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gestion_detalles_gestion_id_key" ON "gestion_detalles"("gestion_id");
CREATE UNIQUE INDEX "gestion_detalles_email_reminder_id_key" ON "gestion_detalles"("email_reminder_id");

INSERT INTO "gestion_detalles" (
  "id",
  "gestion_id",
  "estado",
  "descripcion",
  "email_reminder_id",
  "created_at",
  "updated_at"
)
SELECT
  g."id" || '-detalle',
  g."id",
  g."estado",
  g."descripcion",
  g."email_reminder_id",
  g."created_at",
  g."updated_at"
FROM "gestiones" g;

ALTER TABLE "gestion_detalles"
  ADD CONSTRAINT "gestion_detalles_gestion_id_fkey"
  FOREIGN KEY ("gestion_id") REFERENCES "gestiones"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gestion_detalles"
  ADD CONSTRAINT "gestion_detalles_email_reminder_id_fkey"
  FOREIGN KEY ("email_reminder_id") REFERENCES "payment_reminder_emails"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3) Quitar payload de gestiones
ALTER TABLE "gestiones" DROP CONSTRAINT IF EXISTS "gestiones_email_reminder_id_fkey";
DROP INDEX IF EXISTS "gestiones_email_reminder_id_key";

ALTER TABLE "gestiones"
  DROP COLUMN "estado",
  DROP COLUMN "descripcion",
  DROP COLUMN "origen",
  DROP COLUMN "email_reminder_id";
