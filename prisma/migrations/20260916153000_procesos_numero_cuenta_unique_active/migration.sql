-- Unicidad de número de radicado solo entre filas vivas.
-- El UNIQUE global bloqueaba recrear un radicado tras soft-delete.

DROP INDEX IF EXISTS "procesos_legales_numero_cuenta_key";

CREATE UNIQUE INDEX "procesos_legales_numero_cuenta_active_key"
  ON "procesos_legales" ("numero_cuenta")
  WHERE "deleted_at" IS NULL;
