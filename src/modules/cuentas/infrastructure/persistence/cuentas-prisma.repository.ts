import { ensureCreditorForLegacyCliente } from "./ensure-creditor-for-cliente.js";
import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import { ApiError } from "../../../../shared/http/error-handler.js";
import { Prisma } from "@prisma/client";
import { formatYmdInTimeZone, getBusinessTimeZone, getBusinessTodayYmd } from "../../domain/business-calendar.js";
import {
  ensureDeudores,
  normalizeDeudores,
  patchPrimaryDeudor,
} from "../../domain/deudores.js";
import { computeDiasEnMora, dateToYmdUtc, resolveEdadMoraDias } from "../../domain/mora.js";
import { refreshCuentaMoraAggregates } from "./refresh-mora-aggregates.js";
import { recomputeHistorialSaldosForCuenta } from "./recompute-historial-saldos.js";
import {
  cobroFieldsFromDeudores,
  deudoresFromLinks,
  cuentaDeudoresInclude,
  syncCuentaDeudores,
} from "./sync-cuenta-deudores.js";
import type {
  ConceptoPago,
  DeudorCobro,
  EstadoPago,
  HistorialPago,
  CuentasPersistencePort,
  Cuenta,
  Gestion,
  TipoPersona,
  TipoCuenta,
} from "../../domain/ports/cuentas-persistence.port.js";

function ymdToUtcNoon(value: string, field: string): Date {
  const d = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} inválida`);
  }
  return d;
}

function cobroDateFromInput(value: string | null | undefined): Date | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return ymdToUtcNoon(value, "fecha de cobro");
}

function fechaPagoFromInput(value: string | null | undefined): Date | null {
  if (value === undefined || value === null) return null;
  return ymdToUtcNoon(value, "fecha_pago");
}

const GESTION_TIPO_EMAIL_REMINDER = "email_reminder";

function assertGestionMutable(gestion: { tipo: string }) {
  if (gestion.tipo === GESTION_TIPO_EMAIL_REMINDER) {
    throw new ApiError(
      403,
      "GESTION_READONLY",
      "Las gestiones creadas por recordatorio de correo no se pueden editar ni eliminar",
    );
  }
}

function parseGestionFecha(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(400, "VALIDATION_ERROR", "fecha inválida");
  }
  return d;
}

type GestionRow = {
  id: string;
  cuenta_id: string;
  fecha: Date;
  tipo: "manual" | "email_reminder";
  estado: string;
  descripcion: string;
  created_at: Date;
  updated_at: Date;
};

function mapGestion(row: GestionRow): Gestion {
  return {
    id: row.id,
    cuenta_id: row.cuenta_id,
    fecha: row.fecha,
    tipo: row.tipo,
    estado: row.estado,
    descripcion: row.descripcion,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function assertValidDeudores(deudores: DeudorCobro[]) {
  if (deudores.length < 1) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Se requiere al menos un deudor de cobro",
    );
  }
  const cobro = cobroFieldsFromDeudores(deudores);
  if (!cobro.cobro_nombre || !cobro.cobro_documento) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Los datos de cobro (nombre y documento) son obligatorios",
    );
  }
}

type HistorialMoraRow = {
  periodo: string;
  estado_pago: EstadoPago;
  fecha_pago: Date | null;
};

type CuentaRow = {
  id: string;
  cliente_id: string;
  creditor_id: string | null;
  tipo_cuenta: TipoCuenta;
  identificador: string;
  direccion: string | null;
  notas: string | null;
  cobro_nombre: string;
  cobro_tipo_persona: TipoPersona;
  cobro_documento: string;
  cobro_email: string | null;
  monto_a_la_fecha: unknown;
  edad_mora_dias: number | null;
  fecha_inicio_cobro: Date | null;
  fecha_fin_cobro: Date | null;
  created_at: Date;
  updated_at: Date;
  historial_pagos?: HistorialMoraRow[];
  cuenta_deudores?: {
    deudor: {
      id: string;
      nombre: string;
      tipo_persona: TipoPersona;
      documento: string;
      emails: string[];
      telefono: string | null;
    };
  }[];
};

const cuentaReadInclude = {
  ...cuentaDeudoresInclude,
  historial_pagos: {
    where: { deleted_at: null },
    select: { periodo: true, estado_pago: true, fecha_pago: true },
  },
} as const;

function mapCuenta(row: CuentaRow): Cuenta {
  const fromLinks =
    row.cuenta_deudores && row.cuenta_deudores.length > 0
      ? deudoresFromLinks(row.cuenta_deudores, row.cobro_documento)
      : null;
  const deudores =
    fromLinks ??
    ensureDeudores(null, {
      cobro_nombre: row.cobro_nombre,
      cobro_tipo_persona: row.cobro_tipo_persona,
      cobro_documento: row.cobro_documento,
      cobro_email: row.cobro_email,
    });
  const cobro = cobroFieldsFromDeudores(deudores);
  const todayYmd = getBusinessTodayYmd();
  const createdAtYmd = formatYmdInTimeZone(row.created_at, getBusinessTimeZone());
  const inicioYmd = row.fecha_inicio_cobro ? dateToYmdUtc(row.fecha_inicio_cobro) : null;
  const edadViva = resolveEdadMoraDias({
    movimientos: row.historial_pagos ?? [],
    fechaInicioCobroYmd: inicioYmd,
    createdAtYmd,
    referenceTodayYmd: todayYmd,
  });
  const fechaInicioCobro =
    row.fecha_inicio_cobro ??
    (createdAtYmd ? new Date(`${createdAtYmd}T12:00:00.000Z`) : null);
  return {
    id: row.id,
    cliente_id: row.cliente_id,
    creditor_id: row.creditor_id,
    tipo_cuenta: row.tipo_cuenta,
    identificador: row.identificador,
    direccion: row.direccion,
    notas: row.notas,
    cobro_nombre: cobro.cobro_nombre,
    cobro_tipo_persona: cobro.cobro_tipo_persona,
    cobro_documento: cobro.cobro_documento,
    cobro_email: cobro.cobro_email,
    deudores,
    monto_a_la_fecha: row.monto_a_la_fecha,
    edad_mora_dias: edadViva ?? row.edad_mora_dias,
    fecha_inicio_cobro: fechaInicioCobro,
    fecha_fin_cobro: row.fecha_fin_cobro,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class CuentasPrismaRepository implements CuentasPersistencePort {
  async listCuentas(input: {
    cliente_id?: string | undefined;
    tipo_cuenta?: TipoCuenta | undefined;
  }): Promise<Cuenta[]> {
    const rows = await prisma.cuenta.findMany({
      where: {
        ...(input.cliente_id ? { cliente_id: input.cliente_id } : {}),
        ...(input.tipo_cuenta ? { tipo_cuenta: input.tipo_cuenta } : {}),
        deleted_at: null,
      },
      include: cuentaReadInclude,
      orderBy: { created_at: "desc" },
    });
    return rows.map((row) => mapCuenta(row as CuentaRow));
  }

  async getCuentaById(id: string): Promise<Cuenta | null> {
    const row = await prisma.cuenta.findFirst({
      where: { id, deleted_at: null },
      include: cuentaReadInclude,
    });
    return row ? mapCuenta(row as CuentaRow) : null;
  }

  async createCuenta(input: {
    cliente_id: string;
    tipo_cuenta: TipoCuenta;
    identificador: string;
    direccion?: string | undefined;
    notas?: string | undefined;
    saldo_inicial?: number | undefined;
    fecha_inicio_cobro?: string | null | undefined;
    deudores: DeudorCobro[];
  }): Promise<Cuenta> {
    const cliente = await prisma.cliente.findUnique({ where: { id: input.cliente_id } });
    if (!cliente) {
      throw new ApiError(404, "NOT_FOUND", "Cliente no encontrado");
    }

    const deudores = normalizeDeudores(input.deudores);
    assertValidDeudores(deudores);
    const cobro = cobroFieldsFromDeudores(deudores);

    const created = await prisma.$transaction(async (tx) => {
      const creditor = await ensureCreditorForLegacyCliente(input.cliente_id, tx);

      const cuenta = await tx.cuenta.create({
        data: {
          cliente_id: input.cliente_id,
          creditor_id: creditor.id,
          tipo_cuenta: input.tipo_cuenta,
          identificador: input.identificador,
          direccion: input.direccion,
          notas: input.notas,
          monto_a_la_fecha: input.saldo_inicial ?? 0,
          cobro_nombre: cobro.cobro_nombre,
          cobro_tipo_persona: cobro.cobro_tipo_persona,
          cobro_documento: cobro.cobro_documento,
          cobro_email: cobro.cobro_email,
          fecha_inicio_cobro:
            cobroDateFromInput(input.fecha_inicio_cobro) ??
            cobroDateFromInput(getBusinessTodayYmd()),
        },
      });

      await syncCuentaDeudores(tx, {
        cuentaId: cuenta.id,
        deudores,
      });

      return tx.cuenta.findUniqueOrThrow({
        where: { id: cuenta.id },
        include: cuentaReadInclude,
      });
    });

    return mapCuenta(created as CuentaRow);
  }

  async updateCuenta(input: {
    id: string;
    tipo_cuenta?: TipoCuenta | undefined;
    identificador?: string | undefined;
    direccion?: string | undefined;
    notas?: string | undefined;
    saldo_inicial?: number | undefined;
    deudores?: DeudorCobro[] | undefined;
    cobro_nombre?: string | undefined;
    cobro_tipo_persona?: TipoPersona | undefined;
    cobro_documento?: string | undefined;
    cobro_email?: string | null | undefined;
    fecha_inicio_cobro?: string | null | undefined;
  }): Promise<Cuenta> {
    const existing = await prisma.cuenta.findFirst({
      where: { id: input.id, deleted_at: null },
      include: cuentaReadInclude,
    });
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Cuenta no encontrada");
    }

    const data: {
      tipo_cuenta?: TipoCuenta;
      identificador?: string;
      direccion?: string;
      notas?: string;
      monto_a_la_fecha?: number;
      cobro_nombre?: string;
      cobro_tipo_persona?: TipoPersona;
      cobro_documento?: string;
      cobro_email?: string | null;
      fecha_inicio_cobro?: Date | null;
    } = {};

    if (input.tipo_cuenta !== undefined) data.tipo_cuenta = input.tipo_cuenta;
    if (input.identificador !== undefined) data.identificador = input.identificador;
    if (input.direccion !== undefined) data.direccion = input.direccion;
    if (input.notas !== undefined) data.notas = input.notas;
    if (input.saldo_inicial !== undefined) data.monto_a_la_fecha = input.saldo_inicial;
    if (input.fecha_inicio_cobro !== undefined) {
      data.fecha_inicio_cobro = cobroDateFromInput(input.fecha_inicio_cobro);
    }

    let nextDeudores: DeudorCobro[] | null = null;

    if (input.deudores !== undefined) {
      nextDeudores = normalizeDeudores(input.deudores);
      assertValidDeudores(nextDeudores);
    } else {
      const hasCobroPatch =
        input.cobro_nombre !== undefined ||
        input.cobro_tipo_persona !== undefined ||
        input.cobro_documento !== undefined ||
        input.cobro_email !== undefined;

      if (hasCobroPatch) {
        const currentDeudores = deudoresFromLinks(
          existing.cuenta_deudores,
          existing.cobro_documento,
        );
        nextDeudores = patchPrimaryDeudor(
          currentDeudores.length > 0
            ? currentDeudores
            : ensureDeudores(null, {
                cobro_nombre: existing.cobro_nombre,
                cobro_tipo_persona: existing.cobro_tipo_persona,
                cobro_documento: existing.cobro_documento,
                cobro_email: existing.cobro_email,
              }),
          {
            cobro_nombre: input.cobro_nombre,
            cobro_tipo_persona: input.cobro_tipo_persona,
            cobro_documento: input.cobro_documento,
            cobro_email: input.cobro_email,
          },
        );
        assertValidDeudores(nextDeudores);
      }
    }

    if (nextDeudores) {
      const cobro = cobroFieldsFromDeudores(nextDeudores);
      data.cobro_nombre = cobro.cobro_nombre;
      data.cobro_tipo_persona = cobro.cobro_tipo_persona;
      data.cobro_documento = cobro.cobro_documento;
      data.cobro_email = cobro.cobro_email;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.cuenta.update({
        where: { id: input.id },
        data,
      });

      if (nextDeudores) {
        await syncCuentaDeudores(tx, {
          cuentaId: input.id,
          deudores: nextDeudores,
        });
      }

      return tx.cuenta.findUniqueOrThrow({
        where: { id: input.id },
        include: cuentaReadInclude,
      });
    });

    return mapCuenta(updated as CuentaRow);
  }

  async deleteCuentaCascade(id: string): Promise<void> {
    try {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const deletedAt = new Date();
        const result = await tx.cuenta.updateMany({
          where: { id, deleted_at: null },
          data: { deleted_at: deletedAt },
        });

        if (result.count === 0) {
          throw new ApiError(404, "NOT_FOUND", "Cuenta no encontrada");
        }

        // El historial se conserva, pero queda fuera de cálculos y listados operativos.
        await tx.historialPago.updateMany({
          where: { cuenta_id: id, deleted_at: null },
          data: { deleted_at: deletedAt },
        });
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new ApiError(404, "NOT_FOUND", "Cuenta no encontrada");
        }
        if (error.code === "P2003") {
          throw new ApiError(
            409,
            "CONFLICT",
            "No se puede eliminar la cuenta porque tiene registros asociados",
          );
        }
      }
      throw error;
    }
  }

  async listHistorialPagosByCuentaId(cuentaId: string): Promise<HistorialPago[]> {
    return (await prisma.historialPago.findMany({
      where: { cuenta_id: cuentaId, deleted_at: null },
      orderBy: { created_at: "desc" },
    })) as unknown as HistorialPago[];
  }

  async createHistorialPagoAndUpdateSaldo(input: {
    cuentaId: string;
    periodo: string;
    concepto: ConceptoPago;
    valor_cobrado: number;
    valor_pagado: number;
    fecha_pago?: string | null | undefined;
    estado_pago: EstadoPago;
    observaciones?: string | undefined;
    fecha_inicio_cobro?: string | null;
    fecha_fin_cobro?: string | null;
  }): Promise<HistorialPago> {
    return (await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const cuenta = await tx.cuenta.findFirst({
        where: { id: input.cuentaId, deleted_at: null },
      });
      if (!cuenta) {
        throw new ApiError(404, "NOT_FOUND", "Cuenta no encontrada");
      }

      const lastHistorial = await tx.historialPago.findFirst({
        where: { cuenta_id: input.cuentaId, deleted_at: null },
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
      });
      const saldoAnterior =
        lastHistorial != null
          ? Number(lastHistorial.monto_a_la_fecha)
          : Number(cuenta.monto_a_la_fecha);
      const saldoNuevo = saldoAnterior + input.valor_cobrado - input.valor_pagado;

      const fechaPagoDate = fechaPagoFromInput(input.fecha_pago);
      const fechaInicioCobro = cobroDateFromInput(input.fecha_inicio_cobro);
      const fechaFinCobro = cobroDateFromInput(input.fecha_fin_cobro);
      if (fechaInicioCobro && fechaFinCobro && fechaFinCobro < fechaInicioCobro) {
        throw new ApiError(400, "VALIDATION_ERROR", "fecha_fin_cobro debe ser >= fecha_inicio_cobro");
      }

      const diasEnMora = computeDiasEnMora({
        periodo: input.periodo,
        estado_pago: input.estado_pago,
        fecha_pago: fechaPagoDate,
        referenceTodayYmd: getBusinessTodayYmd(),
      });

      const historial = await tx.historialPago.create({
        data: {
          cuenta_id: input.cuentaId,
          periodo: input.periodo,
          concepto: input.concepto,
          valor_cobrado: input.valor_cobrado,
          valor_pagado: input.valor_pagado,
          fecha_pago: fechaPagoDate,
          estado_pago: input.estado_pago,
          monto_a_la_fecha: saldoNuevo,
          observaciones: input.observaciones,
          dias_en_mora: diasEnMora,
          fecha_inicio_cobro: fechaInicioCobro,
          fecha_fin_cobro: fechaFinCobro,
        },
      });

      await tx.cuenta.update({
        where: { id: input.cuentaId },
        data: { monto_a_la_fecha: saldoNuevo },
      });

      await refreshCuentaMoraAggregates(tx, input.cuentaId);

      return historial;
    })) as unknown as HistorialPago;
  }

  async deleteHistorialPagoAndUpdateSaldo(input: {
    cuentaId: string;
    historialId: string;
  }): Promise<void> {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const historial = await tx.historialPago.findFirst({
        where: {
          id: input.historialId,
          cuenta_id: input.cuentaId,
          deleted_at: null,
        },
      });
      if (!historial) {
        throw new ApiError(404, "NOT_FOUND", "Historial no encontrado para la cuenta");
      }

      await tx.historialPago.update({
        where: { id: input.historialId },
        data: { deleted_at: new Date() },
      });
      await recomputeHistorialSaldosForCuenta(tx, input.cuentaId);
    });
  }

  async updateHistorialPagoAndUpdateSaldo(input: {
    cuentaId: string;
    historialId: string;
    periodo: string;
    concepto: ConceptoPago;
    valor_cobrado: number;
    valor_pagado: number;
    fecha_pago?: string | null | undefined;
    estado_pago: EstadoPago;
    observaciones?: string | undefined;
    fecha_inicio_cobro?: string | null;
    fecha_fin_cobro?: string | null;
  }): Promise<HistorialPago> {
    return (await prisma.$transaction(async (tx) => {
      const historial = await tx.historialPago.findFirst({
        where: {
          id: input.historialId,
          cuenta_id: input.cuentaId,
          deleted_at: null,
        },
      });
      if (!historial) {
        throw new ApiError(404, "NOT_FOUND", "Historial no encontrado para la cuenta");
      }

      const fechaPagoDate = fechaPagoFromInput(input.fecha_pago);
      const fechaInicioCobro = cobroDateFromInput(input.fecha_inicio_cobro);
      const fechaFinCobro = cobroDateFromInput(input.fecha_fin_cobro);
      if (fechaInicioCobro && fechaFinCobro && fechaFinCobro < fechaInicioCobro) {
        throw new ApiError(400, "VALIDATION_ERROR", "fecha_fin_cobro debe ser >= fecha_inicio_cobro");
      }

      await tx.historialPago.update({
        where: { id: input.historialId },
        data: {
          periodo: input.periodo,
          concepto: input.concepto,
          valor_cobrado: input.valor_cobrado,
          valor_pagado: input.valor_pagado,
          fecha_pago: fechaPagoDate,
          estado_pago: input.estado_pago,
          observaciones: input.observaciones,
          fecha_inicio_cobro: fechaInicioCobro,
          fecha_fin_cobro: fechaFinCobro,
        },
      });

      await recomputeHistorialSaldosForCuenta(tx, input.cuentaId);

      const updated = await tx.historialPago.findUnique({ where: { id: input.historialId } });
      return updated!;
    })) as unknown as HistorialPago;
  }

  async listGestionesByCuentaId(cuentaId: string): Promise<Gestion[]> {
    const rows = await prisma.gestion.findMany({
      where: { cuenta_id: cuentaId },
      orderBy: { fecha: "desc" },
    });
    return rows.map((row) => mapGestion(row as GestionRow));
  }

  async createGestionForCuenta(input: {
    cuentaId: string;
    fecha: string;
    estado: string;
    descripcion: string;
  }): Promise<Gestion> {
    const row = await prisma.gestion.create({
      data: {
        cuenta_id: input.cuentaId,
        fecha: parseGestionFecha(input.fecha),
        tipo: "manual",
        estado: input.estado,
        descripcion: input.descripcion,
      },
    });
    return mapGestion(row as GestionRow);
  }

  async updateGestionForCuenta(input: {
    cuentaId: string;
    gestionId: string;
    fecha?: string;
    estado?: string;
    descripcion?: string;
  }): Promise<Gestion> {
    const gestion = await prisma.gestion.findUnique({
      where: { id: input.gestionId },
    });
    if (!gestion || gestion.cuenta_id !== input.cuentaId) {
      throw new ApiError(404, "NOT_FOUND", "Gestion no encontrada para la cuenta");
    }
    assertGestionMutable(gestion);

    const row = await prisma.gestion.update({
      where: { id: input.gestionId },
      data: {
        ...(input.fecha != null ? { fecha: parseGestionFecha(input.fecha) } : {}),
        ...(input.estado != null ? { estado: input.estado } : {}),
        ...(input.descripcion != null ? { descripcion: input.descripcion } : {}),
      },
    });
    return mapGestion(row as GestionRow);
  }

  async deleteGestionForCuenta(input: {
    cuentaId: string;
    gestionId: string;
  }): Promise<void> {
    const gestion = await prisma.gestion.findUnique({ where: { id: input.gestionId } });
    if (!gestion || gestion.cuenta_id !== input.cuentaId) {
      throw new ApiError(404, "NOT_FOUND", "Gestion no encontrada para la cuenta");
    }
    assertGestionMutable(gestion);

    await prisma.gestion.delete({ where: { id: input.gestionId } });
  }
}
