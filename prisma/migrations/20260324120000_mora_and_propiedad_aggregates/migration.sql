-- Mora, ventana de cobro en historial y agregados en propiedades (BACKEND_API §6.5.1)

ALTER TABLE "historial_pagos" ADD COLUMN "dias_en_mora" INTEGER;
ALTER TABLE "historial_pagos" ADD COLUMN "fecha_inicio_cobro" DATE;
ALTER TABLE "historial_pagos" ADD COLUMN "fecha_fin_cobro" DATE;

ALTER TABLE "historial_pagos" ADD CONSTRAINT "chk_historial_cobro_fechas" CHECK (
  "fecha_inicio_cobro" IS NULL OR "fecha_fin_cobro" IS NULL OR "fecha_fin_cobro" >= "fecha_inicio_cobro"
);

ALTER TABLE "propiedades" ADD COLUMN "edad_mora_dias" INTEGER;
ALTER TABLE "propiedades" ADD COLUMN "fecha_inicio_cobro" DATE;
ALTER TABLE "propiedades" ADD COLUMN "fecha_fin_cobro" DATE;

ALTER TABLE "propiedades" ADD CONSTRAINT "chk_propiedades_cobro_agg_fechas" CHECK (
  "fecha_inicio_cobro" IS NULL OR "fecha_fin_cobro" IS NULL OR "fecha_fin_cobro" >= "fecha_inicio_cobro"
);
