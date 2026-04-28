/**
 * Tras aplicar la migración de mora: recalcula `historial_pagos.dias_en_mora` y
 * refresca agregados en `propiedades` (edad_mora_dias, fechas de cobro).
 *
 * Uso: `npm run db:backfill-mora` (requiere DATABASE_URL y dependencias instaladas).
 * La fecha de referencia para ítems impagos es "hoy" en BUSINESS_TIMEZONE al ejecutar el script.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getBusinessTodayYmd } from "../src/modules/propiedades/domain/business-calendar.js";
import { computeDiasEnMora } from "../src/modules/propiedades/domain/mora.js";
import { refreshPropiedadMoraAggregates } from "../src/modules/propiedades/infrastructure/persistence/refresh-mora-aggregates.js";

const prisma = new PrismaClient();

async function main() {
  const referenceTodayYmd = getBusinessTodayYmd();
  const historiales = await prisma.historialPago.findMany({ orderBy: { id: "asc" } });

  for (const h of historiales) {
    const dias = computeDiasEnMora({
      periodo: h.periodo,
      estado_pago: h.estado_pago,
      fecha_pago: h.fecha_pago,
      referenceTodayYmd,
    });
    await prisma.historialPago.update({
      where: { id: h.id },
      data: { dias_en_mora: dias },
    });
  }

  const propiedades = await prisma.propiedad.findMany({ select: { id: true } });
  for (const { id } of propiedades) {
    await prisma.$transaction(async (tx) => {
      await refreshPropiedadMoraAggregates(tx, id);
    });
  }

  console.log(
    `Backfill mora: ${historiales.length} filas de historial, ${propiedades.length} propiedades (referencia hoy=${referenceTodayYmd}).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
