-- Al borrar una unidad (soft-delete) quedaban cuenta_deudores y radicados vivos.
-- Eso impedía recrear la misma propiedad / el mismo número de radicado.

DELETE FROM cuenta_deudores AS cd
USING cuentas AS cu
WHERE cd.cuenta_id = cu.id
  AND cu.deleted_at IS NOT NULL;

UPDATE procesos_legales AS pl
SET
  deleted_at = cu.deleted_at,
  updated_at = NOW()
FROM cuentas AS cu
WHERE pl.cuenta_id = cu.id
  AND cu.deleted_at IS NOT NULL
  AND pl.deleted_at IS NULL;
