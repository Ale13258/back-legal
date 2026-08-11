-- Soft delete de cuentas: conserva la fila para auditoría.
-- No confundir con estado=cerrada (cierre de negocio).
ALTER TABLE "cuentas" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "idx_cuentas_deleted_at" ON "cuentas"("deleted_at");
