import type { Prisma } from "@prisma/client";

/** Recalcula columnas denormalizadas en `cuentas` a partir de `historial_pagos`. */
export async function refreshCuentaMoraAggregates(
  tx: Prisma.TransactionClient,
  cuentaId: string,
): Promise<void> {
  const agg = await tx.historialPago.aggregate({
    where: { cuenta_id: cuentaId, deleted_at: null },
    _max: { dias_en_mora: true, fecha_fin_cobro: true },
    _min: { fecha_inicio_cobro: true },
  });

  await tx.cuenta.update({
    where: { id: cuentaId },
    data: {
      edad_mora_dias: agg._max.dias_en_mora ?? null,
      ...(agg._min.fecha_inicio_cobro != null
        ? { fecha_inicio_cobro: agg._min.fecha_inicio_cobro }
        : {}),
      ...(agg._max.fecha_fin_cobro != null ? { fecha_fin_cobro: agg._max.fecha_fin_cobro } : {}),
    },
  });
}
