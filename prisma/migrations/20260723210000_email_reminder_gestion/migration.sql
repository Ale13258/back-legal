-- Gestion.fecha: date-only → timestamptz (medianoche UTC para filas legacy)
ALTER TABLE "gestiones" ALTER COLUMN "fecha" TYPE TIMESTAMP(3)
  USING ("fecha"::timestamp);

-- Enlace recordatorio ↔ gestión + origen de solo lectura
ALTER TABLE "gestiones" ADD COLUMN "origen" TEXT;
ALTER TABLE "gestiones" ADD COLUMN "email_reminder_id" TEXT;

CREATE UNIQUE INDEX "gestiones_email_reminder_id_key"
  ON "gestiones"("email_reminder_id");

ALTER TABLE "gestiones"
  ADD CONSTRAINT "gestiones_email_reminder_id_fkey"
  FOREIGN KEY ("email_reminder_id")
  REFERENCES "payment_reminder_emails"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Destinatarios adicionales en el registro de correo
ALTER TABLE "payment_reminder_emails"
  ADD COLUMN "extra_recipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
