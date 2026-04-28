-- Reglas de negocio del blueprint (§6.4 / DDL §6.6)

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_cliente_role_chk" CHECK (
  ("role" = 'cliente'::role_enum AND "cliente_id" IS NOT NULL)
  OR ("role" = 'admin'::role_enum)
);

ALTER TABLE "historial_pagos" ADD CONSTRAINT "chk_historial_montos_nonneg" CHECK (
  "valor_cobrado" >= 0 AND "valor_pagado" >= 0
);
