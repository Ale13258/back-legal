/**
 * Tras aplicar la migración de mora: recalcula `historial_pagos.dias_en_mora` y
 * refresca agregados en `cuentas` (edad_mora_dias, fechas de cobro).
 *
 * Uso: `npm run db:backfill-mora` (requiere DATABASE_URL y dependencias instaladas).
 * La fecha de referencia para ítems impagos es "hoy" en BUSINESS_TIMEZONE al ejecutar el script.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getBusinessTodayYmd } from "../src/modules/cuentas/domain/business-calendar.js";
import { computeDiasEnMora } from "../src/modules/cuentas/domain/mora.js";
import { refreshCuentaMoraAggregates } from "../src/modules/cuentas/infrastructure/persistence/refresh-mora-aggregates.js";

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

  const cuentas = await prisma.cuenta.findMany({ select: { id: true } });
  for (const { id } of cuentas) {
    await prisma.$transaction(async (tx) => {
      await refreshCuentaMoraAggregates(tx, id);
    });
  }

  console.log(
    `Backfill mora: ${historiales.length} filas de historial, ${cuentas.length} cuentas (referencia hoy=${referenceTodayYmd}).`,
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
