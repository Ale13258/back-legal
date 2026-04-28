-- Notifications WhatsApp: secuencias, eventos, trazabilidad e idempotencia.

CREATE TYPE "notification_channel_enum" AS ENUM ('whatsapp');
CREATE TYPE "notification_stage_enum" AS ENUM ('d_minus_3', 'd_day_0', 'd_plus_3');
CREATE TYPE "notification_status_enum" AS ENUM (
  'queued',
  'processing',
  'sent',
  'delivered',
  'read',
  'failed',
  'cancelled'
);

CREATE TABLE "notification_sequences" (
  "id" TEXT NOT NULL,
  "propiedad_id" TEXT NOT NULL,
  "channel" "notification_channel_enum" NOT NULL DEFAULT 'whatsapp',
  "due_date" DATE NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "notification_sequences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_events" (
  "id" TEXT NOT NULL,
  "sequence_id" TEXT NOT NULL,
  "propiedad_id" TEXT NOT NULL,
  "stage" "notification_stage_enum" NOT NULL,
  "channel" "notification_channel_enum" NOT NULL DEFAULT 'whatsapp',
  "status" "notification_status_enum" NOT NULL DEFAULT 'queued',
  "scheduled_for" TIMESTAMPTZ NOT NULL,
  "sent_at" TIMESTAMPTZ,
  "delivered_at" TIMESTAMPTZ,
  "read_at" TIMESTAMPTZ,
  "provider_message_id" TEXT,
  "error_code" TEXT,
  "error_message" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_webhook_events" (
  "id" TEXT NOT NULL,
  "notification_event_id" TEXT,
  "provider_message_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "event_time" TIMESTAMPTZ NOT NULL,
  "payload" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_events_idempotency_key_key"
ON "notification_events" ("idempotency_key");

CREATE UNIQUE INDEX "uq_notification_webhook_dedupe"
ON "notification_webhook_events" ("provider_message_id", "event_type", "event_time");

CREATE INDEX "idx_notification_sequences_propiedad_due"
ON "notification_sequences" ("propiedad_id", "due_date");

CREATE INDEX "idx_notification_events_propiedad_created"
ON "notification_events" ("propiedad_id", "created_at" DESC);

CREATE INDEX "idx_notification_events_status_scheduled"
ON "notification_events" ("status", "scheduled_for");

CREATE INDEX "idx_notification_events_provider_message"
ON "notification_events" ("provider_message_id");

CREATE INDEX "idx_notification_webhook_provider_message"
ON "notification_webhook_events" ("provider_message_id");

ALTER TABLE "notification_sequences"
  ADD CONSTRAINT "notification_sequences_propiedad_id_fkey"
  FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notification_events"
  ADD CONSTRAINT "notification_events_sequence_id_fkey"
  FOREIGN KEY ("sequence_id") REFERENCES "notification_sequences"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notification_events"
  ADD CONSTRAINT "notification_events_propiedad_id_fkey"
  FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notification_webhook_events"
  ADD CONSTRAINT "notification_webhook_events_notification_event_id_fkey"
  FOREIGN KEY ("notification_event_id") REFERENCES "notification_events"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
