import type { Prisma } from "@prisma/client";

/** Recalcula columnas denormalizadas en `propiedades` a partir de `historial_pagos`. */
export async function refreshPropiedadMoraAggregates(
  tx: Prisma.TransactionClient,
  propiedadId: string,
): Promise<void> {
  const agg = await tx.historialPago.aggregate({
    where: { propiedad_id: propiedadId },
    _max: { dias_en_mora: true, fecha_fin_cobro: true },
    _min: { fecha_inicio_cobro: true },
  });

  await tx.propiedad.update({
    where: { id: propiedadId },
    data: {
      edad_mora_dias: agg._max.dias_en_mora ?? null,
      fecha_inicio_cobro: agg._min.fecha_inicio_cobro ?? null,
      fecha_fin_cobro: agg._max.fecha_fin_cobro ?? null,
    },
  });
}
