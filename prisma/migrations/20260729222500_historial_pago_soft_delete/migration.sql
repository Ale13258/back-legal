-- Conserva los registros eliminados del historial de pagos para auditoría.
ALTER TABLE "historial_pagos"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "idx_historial_pagos_deleted_at"
  ON "historial_pagos"("deleted_at");
