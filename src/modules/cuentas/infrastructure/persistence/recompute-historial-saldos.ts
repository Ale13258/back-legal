import type { Prisma } from "@prisma/client";
import { getBusinessTodayYmd } from "../../domain/business-calendar.js";
import { computeDiasEnMora } from "../../domain/mora.js";
import { refreshCuentaMoraAggregates } from "./refresh-mora-aggregates.js";

/** Recalcula monto_a_la_fecha de cada fila y el saldo agregado de la cuenta. */
export async function recomputeHistorialSaldosForCuenta(
  tx: Prisma.TransactionClient,
  cuentaId: string,
): Promise<void> {
  const cuenta = await tx.cuenta.findUnique({ where: { id: cuentaId } });
  if (!cuenta) return;

  const rows = await tx.historialPago.findMany({
    where: { cuenta_id: cuentaId, deleted_at: null },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
  });

  if (rows.length === 0) {
    await tx.cuenta.update({
      where: { id: cuentaId },
      data: { monto_a_la_fecha: 0 },
    });
    await refreshCuentaMoraAggregates(tx, cuentaId);
    return;
  }

  const first = rows[0]!;
  let saldoAnterior =
    Number(first.monto_a_la_fecha) - Number(first.valor_cobrado) + Number(first.valor_pagado);

  const referenceTodayYmd = getBusinessTodayYmd();

  for (const row of rows) {
    const saldoNuevo = saldoAnterior + Number(row.valor_cobrado) - Number(row.valor_pagado);
    const diasEnMora = computeDiasEnMora({
      periodo: row.periodo,
      estado_pago: row.estado_pago,
      fecha_pago: row.fecha_pago,
      referenceTodayYmd,
    });

    await tx.historialPago.update({
      where: { id: row.id },
      data: {
        monto_a_la_fecha: saldoNuevo,
        dias_en_mora: diasEnMora,
      },
    });

    saldoAnterior = saldoNuevo;
  }

  await tx.cuenta.update({
    where: { id: cuentaId },
    data: { monto_a_la_fecha: saldoAnterior },
  });

  await refreshCuentaMoraAggregates(tx, cuentaId);
}
