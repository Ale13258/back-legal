import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma } from "@prisma/client";
import { getBusinessTodayYmd } from "../../domain/business-calendar.js";
import { computeDiasEnMora } from "../../domain/mora.js";
import { recomputeHistorialSaldosForCuenta } from "./recompute-historial-saldos.js";

type HistorialRow = {
  id: string;
  cuenta_id: string;
  periodo: string;
  concepto: "administracion";
  valor_cobrado: number;
  valor_pagado: number;
  fecha_pago: Date | null;
  estado_pago: "pendiente" | "parcial" | "pagado" | "vencido";
  monto_a_la_fecha: number;
  dias_en_mora: number | null;
  fecha_inicio_cobro: Date | null;
  fecha_fin_cobro: Date | null;
  created_at: Date;
};

function createMockTx(
  cuentaId: string,
  initialRows: HistorialRow[],
  initialCuentaSaldo = 0,
) {
  const cuenta = { id: cuentaId, monto_a_la_fecha: initialCuentaSaldo };
  const rows = initialRows.map((row) => ({ ...row }));

  const tx = {
    cuenta: {
      findUnique: async () => cuenta,
      update: async ({
        data,
      }: {
        where: { id: string };
        data: {
          monto_a_la_fecha?: number;
          edad_mora_dias?: number | null;
          fecha_inicio_cobro?: Date;
          fecha_fin_cobro?: Date;
        };
      }) => {
        Object.assign(cuenta, data);
        return cuenta;
      },
    },
    historialPago: {
      findMany: async () =>
        [...rows].sort((a, b) => {
          const byCreated = a.created_at.getTime() - b.created_at.getTime();
          return byCreated !== 0 ? byCreated : a.id.localeCompare(b.id);
        }),
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { monto_a_la_fecha?: number; dias_en_mora?: number | null };
      }) => {
        const row = rows.find((r) => r.id === where.id);
        if (!row) throw new Error(`row not found: ${where.id}`);
        if (data.monto_a_la_fecha != null) row.monto_a_la_fecha = data.monto_a_la_fecha;
        if (data.dias_en_mora !== undefined) row.dias_en_mora = data.dias_en_mora;
        return row;
      },
      aggregate: async () => {
        const dias = rows.map((r) => r.dias_en_mora).filter((d): d is number => d != null);
        const inicios = rows.map((r) => r.fecha_inicio_cobro).filter((d): d is Date => d != null);
        const fines = rows.map((r) => r.fecha_fin_cobro).filter((d): d is Date => d != null);
        return {
          _max: {
            dias_en_mora: dias.length ? Math.max(...dias) : null,
            fecha_fin_cobro: fines.length ? fines.sort((a, b) => b.getTime() - a.getTime())[0]! : null,
          },
          _min: {
            fecha_inicio_cobro: inicios.length
              ? inicios.sort((a, b) => a.getTime() - b.getTime())[0]!
              : null,
          },
        };
      },
    },
  };

  return { tx: tx as unknown as Prisma.TransactionClient, cuenta, rows };
}

function row(
  id: string,
  cuentaId: string,
  createdAt: Date,
  input: {
    valor_cobrado: number;
    valor_pagado: number;
    monto_a_la_fecha: number;
    periodo?: string;
    estado_pago?: HistorialRow["estado_pago"];
    fecha_pago?: Date | null;
  },
): HistorialRow {
  const periodo = input.periodo ?? "2024-01";
  const estado_pago = input.estado_pago ?? "pagado";
  const fecha_pago =
    input.fecha_pago !== undefined
      ? input.fecha_pago
      : new Date(Date.UTC(2024, 0, 15, 12, 0, 0));

  return {
    id,
    cuenta_id: cuentaId,
    periodo,
    concepto: "administracion",
    valor_cobrado: input.valor_cobrado,
    valor_pagado: input.valor_pagado,
    fecha_pago,
    estado_pago,
    monto_a_la_fecha: input.monto_a_la_fecha,
    dias_en_mora: 0,
    fecha_inicio_cobro: null,
    fecha_fin_cobro: null,
    created_at: createdAt,
  };
}

describe("recomputeHistorialSaldosForCuenta", () => {
  const cuentaId = "prop-1";

  it("recalcula saldos en cascada tras editar una fila intermedia", async () => {
    const { tx, cuenta, rows } = createMockTx(cuentaId, [
      row("h1", cuentaId, new Date("2024-01-01"), {
        valor_cobrado: 500,
        valor_pagado: 0,
        monto_a_la_fecha: 1500,
      }),
      row("h2", cuentaId, new Date("2024-02-01"), {
        valor_cobrado: 300,
        valor_pagado: 100,
        monto_a_la_fecha: 1700,
      }),
      row("h3", cuentaId, new Date("2024-03-01"), {
        valor_cobrado: 200,
        valor_pagado: 50,
        monto_a_la_fecha: 1850,
      }),
    ]);

    rows[1]!.valor_cobrado = 500;

    await recomputeHistorialSaldosForCuenta(tx, cuentaId);

    assert.equal(rows[0]!.monto_a_la_fecha, 1500);
    assert.equal(rows[1]!.monto_a_la_fecha, 1900);
    assert.equal(rows[2]!.monto_a_la_fecha, 2050);
    assert.equal(cuenta.monto_a_la_fecha, 2050);
  });

  it("recalcula saldos tras eliminar una fila intermedia", async () => {
    const remaining = [
      row("h1", cuentaId, new Date("2024-01-01"), {
        valor_cobrado: 500,
        valor_pagado: 0,
        monto_a_la_fecha: 1500,
      }),
      row("h3", cuentaId, new Date("2024-03-01"), {
        valor_cobrado: 200,
        valor_pagado: 50,
        monto_a_la_fecha: 1850,
      }),
    ];
    const { tx, cuenta, rows } = createMockTx(cuentaId, remaining);

    await recomputeHistorialSaldosForCuenta(tx, cuentaId);

    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.monto_a_la_fecha, 1500);
    assert.equal(rows[1]!.monto_a_la_fecha, 1650);
    assert.equal(cuenta.monto_a_la_fecha, 1650);
  });

  it("pone saldo de cuenta en 0 cuando no quedan filas", async () => {
    const { tx, cuenta } = createMockTx(cuentaId, [], 1850);

    await recomputeHistorialSaldosForCuenta(tx, cuentaId);

    assert.equal(cuenta.monto_a_la_fecha, 0);
  });

  it("recalcula dias_en_mora en todas las filas", async () => {
    const fechaPago = new Date(Date.UTC(2024, 0, 15, 12, 0, 0));
    const { tx, rows } = createMockTx(cuentaId, [
      row("h1", cuentaId, new Date("2024-01-01"), {
        valor_cobrado: 100,
        valor_pagado: 0,
        monto_a_la_fecha: 1100,
        periodo: "2024-01",
        estado_pago: "pagado",
        fecha_pago: fechaPago,
      }),
      row("h2", cuentaId, new Date("2024-02-01"), {
        valor_cobrado: 100,
        valor_pagado: 0,
        monto_a_la_fecha: 1200,
        periodo: "2024-02",
        estado_pago: "pendiente",
        fecha_pago: null,
      }),
    ]);

    const referenceTodayYmd = getBusinessTodayYmd();

    await recomputeHistorialSaldosForCuenta(tx, cuentaId);

    assert.equal(
      rows[0]!.dias_en_mora,
      computeDiasEnMora({
        periodo: "2024-01",
        estado_pago: "pagado",
        fecha_pago: fechaPago,
        referenceTodayYmd,
      }),
    );
    assert.equal(
      rows[1]!.dias_en_mora,
      computeDiasEnMora({
        periodo: "2024-02",
        estado_pago: "pendiente",
        fecha_pago: null,
        referenceTodayYmd,
      }),
    );
  });
});
