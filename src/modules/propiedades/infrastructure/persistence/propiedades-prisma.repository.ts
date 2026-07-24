import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import { ApiError } from "../../../../shared/http/error-handler.js";
import { Prisma } from "@prisma/client";
import { getBusinessTodayYmd } from "../../domain/business-calendar.js";
import {
  cobroFromDeudor,
  ensureDeudores,
  normalizeDeudores,
  patchPrimaryDeudor,
} from "../../domain/deudores.js";
import { computeDiasEnMora } from "../../domain/mora.js";
import { refreshPropiedadMoraAggregates } from "./refresh-mora-aggregates.js";
import { recomputeHistorialSaldosForPropiedad } from "./recompute-historial-saldos.js";
import type {
  ConceptoPago,
  DeudorCobro,
  EstadoPago,
  HistorialPago,
  PropiedadesPersistencePort,
  Propiedad,
  Gestion,
  TipoPersona,
  TipoPropiedad,
} from "../../domain/ports/propiedades-persistence.port.js";

function ymdToUtcNoon(value: string, field: string): Date {
  const d = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} inválida`);
  }
  return d;
}

function cobroDateFromInput(value: string | null | undefined): Date | null {
  if (value === undefined || value === null) return null;
  return ymdToUtcNoon(value, "fecha de cobro");
}

function fechaPagoFromInput(value: string | null | undefined): Date | null {
  if (value === undefined || value === null) return null;
  return ymdToUtcNoon(value, "fecha_pago");
}

const GESTION_ORIGEN_EMAIL_REMINDER = "email_reminder";

function assertGestionMutable(gestion: { origen: string | null }) {
  if (gestion.origen === GESTION_ORIGEN_EMAIL_REMINDER) {
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

function mapPropiedad(row: {
  id: string;
  cliente_id: string;
  tipo_propiedad: TipoPropiedad;
  identificador: string;
  direccion: string | null;
  notas: string | null;
  cobro_nombre: string;
  cobro_tipo_persona: TipoPersona;
  cobro_documento: string;
  cobro_email: string;
  deudores: unknown;
  monto_a_la_fecha: unknown;
  edad_mora_dias: number | null;
  fecha_inicio_cobro: Date | null;
  fecha_fin_cobro: Date | null;
  created_at: Date;
  updated_at: Date;
}): Propiedad {
  const deudores = ensureDeudores(row.deudores, {
    cobro_nombre: row.cobro_nombre,
    cobro_tipo_persona: row.cobro_tipo_persona,
    cobro_documento: row.cobro_documento,
    cobro_email: row.cobro_email,
  });
  return {
    id: row.id,
    cliente_id: row.cliente_id,
    tipo_propiedad: row.tipo_propiedad,
    identificador: row.identificador,
    direccion: row.direccion,
    notas: row.notas,
    cobro_nombre: row.cobro_nombre,
    cobro_tipo_persona: row.cobro_tipo_persona,
    cobro_documento: row.cobro_documento,
    cobro_email: row.cobro_email,
    deudores,
    monto_a_la_fecha: row.monto_a_la_fecha,
    edad_mora_dias: row.edad_mora_dias,
    fecha_inicio_cobro: row.fecha_inicio_cobro,
    fecha_fin_cobro: row.fecha_fin_cobro,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class PropiedadesPrismaRepository implements PropiedadesPersistencePort {
  async listPropiedades(input: {
    cliente_id?: string | undefined;
    tipo_propiedad?: TipoPropiedad | undefined;
  }): Promise<Propiedad[]> {
    const rows = await prisma.propiedad.findMany({
      where: {
        ...(input.cliente_id ? { cliente_id: input.cliente_id } : {}),
        ...(input.tipo_propiedad ? { tipo_propiedad: input.tipo_propiedad } : {}),
      },
      orderBy: { created_at: "desc" },
    });
    return rows.map((row) => mapPropiedad(row as Parameters<typeof mapPropiedad>[0]));
  }

  async getPropiedadById(id: string): Promise<Propiedad | null> {
    const row = await prisma.propiedad.findUnique({ where: { id } });
    return row ? mapPropiedad(row as Parameters<typeof mapPropiedad>[0]) : null;
  }

  async createPropiedad(input: {
    cliente_id: string;
    tipo_propiedad: TipoPropiedad;
    identificador: string;
    direccion?: string | undefined;
    notas?: string | undefined;
    saldo_inicial?: number | undefined;
    fecha_inicio_cobro?: string | null | undefined;
    deudores: DeudorCobro[];
  }): Promise<Propiedad> {
    const cliente = await prisma.cliente.findUnique({ where: { id: input.cliente_id } });
    if (!cliente) {
      throw new ApiError(404, "NOT_FOUND", "Cliente no encontrado");
    }

    const deudores = normalizeDeudores(input.deudores);
    if (deudores.length < 1 || deudores.some((d) => d.emails.length < 1)) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Se requiere al menos un deudor con un email de cobro",
      );
    }
    const primary = deudores[0]!;
    const cobro = cobroFromDeudor(primary);
    if (!cobro.cobro_nombre || !cobro.cobro_documento || !cobro.cobro_email) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Los datos de cobro (nombre, documento y correo) son obligatorios",
      );
    }

    const created = await prisma.propiedad.create({
      data: {
        cliente_id: input.cliente_id,
        tipo_propiedad: input.tipo_propiedad,
        identificador: input.identificador,
        direccion: input.direccion,
        notas: input.notas,
        monto_a_la_fecha: input.saldo_inicial ?? 0,
        cobro_nombre: cobro.cobro_nombre,
        cobro_tipo_persona: cobro.cobro_tipo_persona,
        cobro_documento: cobro.cobro_documento,
        cobro_email: cobro.cobro_email,
        deudores: deudores as unknown as Prisma.InputJsonValue,
        fecha_inicio_cobro: cobroDateFromInput(input.fecha_inicio_cobro),
      },
    });
    return mapPropiedad(created as Parameters<typeof mapPropiedad>[0]);
  }

  async updatePropiedad(input: {
    id: string;
    tipo_propiedad?: TipoPropiedad | undefined;
    identificador?: string | undefined;
    direccion?: string | undefined;
    notas?: string | undefined;
    saldo_inicial?: number | undefined;
    deudores?: DeudorCobro[] | undefined;
    cobro_nombre?: string | undefined;
    cobro_tipo_persona?: TipoPersona | undefined;
    cobro_documento?: string | undefined;
    cobro_email?: string | undefined;
    fecha_inicio_cobro?: string | null | undefined;
  }): Promise<Propiedad> {
    const data: {
      tipo_propiedad?: TipoPropiedad;
      identificador?: string;
      direccion?: string;
      notas?: string;
      monto_a_la_fecha?: number;
      cobro_nombre?: string;
      cobro_tipo_persona?: TipoPersona;
      cobro_documento?: string;
      cobro_email?: string;
      deudores?: Prisma.InputJsonValue;
      fecha_inicio_cobro?: Date | null;
    } = {};

    if (input.tipo_propiedad !== undefined) data.tipo_propiedad = input.tipo_propiedad;
    if (input.identificador !== undefined) data.identificador = input.identificador;
    if (input.direccion !== undefined) data.direccion = input.direccion;
    if (input.notas !== undefined) data.notas = input.notas;
    if (input.saldo_inicial !== undefined) data.monto_a_la_fecha = input.saldo_inicial;
    if (input.fecha_inicio_cobro !== undefined) {
      data.fecha_inicio_cobro = cobroDateFromInput(input.fecha_inicio_cobro);
    }

    if (input.deudores !== undefined) {
      const deudores = normalizeDeudores(input.deudores);
      if (deudores.length < 1 || deudores.some((d) => d.emails.length < 1)) {
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "Se requiere al menos un deudor con un email de cobro",
        );
      }
      const cobro = cobroFromDeudor(deudores[0]!);
      data.deudores = deudores as unknown as Prisma.InputJsonValue;
      data.cobro_nombre = cobro.cobro_nombre;
      data.cobro_tipo_persona = cobro.cobro_tipo_persona;
      data.cobro_documento = cobro.cobro_documento;
      data.cobro_email = cobro.cobro_email;
    } else {
      const hasCobroPatch =
        input.cobro_nombre !== undefined ||
        input.cobro_tipo_persona !== undefined ||
        input.cobro_documento !== undefined ||
        input.cobro_email !== undefined;

      if (hasCobroPatch) {
        const existing = await prisma.propiedad.findUnique({ where: { id: input.id } });
        if (!existing) {
          throw new ApiError(404, "NOT_FOUND", "Propiedad no encontrada");
        }
        const currentDeudores = ensureDeudores(existing.deudores, {
          cobro_nombre: existing.cobro_nombre,
          cobro_tipo_persona: existing.cobro_tipo_persona,
          cobro_documento: existing.cobro_documento,
          cobro_email: existing.cobro_email,
        });
        const nextDeudores = patchPrimaryDeudor(currentDeudores, {
          cobro_nombre: input.cobro_nombre,
          cobro_tipo_persona: input.cobro_tipo_persona,
          cobro_documento: input.cobro_documento,
          cobro_email: input.cobro_email,
        });
        const cobro = cobroFromDeudor(nextDeudores[0]!);
        data.deudores = nextDeudores as unknown as Prisma.InputJsonValue;
        data.cobro_nombre = cobro.cobro_nombre;
        data.cobro_tipo_persona = cobro.cobro_tipo_persona;
        data.cobro_documento = cobro.cobro_documento;
        data.cobro_email = cobro.cobro_email;
      }
    }

    const updated = await prisma.propiedad.update({
      where: { id: input.id },
      data,
    });
    return mapPropiedad(updated as Parameters<typeof mapPropiedad>[0]);
  }

  async deletePropiedadCascade(id: string): Promise<void> {
    try {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Gestiones primero: FK Restrict desde gestiones.email_reminder_id → payment_reminder_emails
        await tx.gestion.deleteMany({ where: { propiedad_id: id } });
        await tx.paymentReminderEmail.deleteMany({ where: { propiedad_id: id } });
        await tx.historialPago.deleteMany({ where: { propiedad_id: id } });
        // La cuenta pertenece al cliente; solo se desasocia de la propiedad
        // (propiedad_id es opcional) para no destruir datos financieros.
        await tx.cuenta.updateMany({
          where: { propiedad_id: id },
          data: { propiedad_id: null },
        });
        await tx.propiedad.delete({ where: { id } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new ApiError(404, "NOT_FOUND", "Propiedad no encontrada");
        }
        if (error.code === "P2003") {
          throw new ApiError(
            409,
            "CONFLICT",
            "No se puede eliminar la propiedad porque tiene registros asociados",
          );
        }
      }
      throw error;
    }
  }

  async listHistorialPagosByPropiedadId(propiedadId: string): Promise<HistorialPago[]> {
    return (await prisma.historialPago.findMany({
      where: { propiedad_id: propiedadId },
      orderBy: { created_at: "desc" },
    })) as unknown as HistorialPago[];
  }

  async createHistorialPagoAndUpdateSaldo(input: {
    propiedadId: string;
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
      const propiedad = await tx.propiedad.findUnique({ where: { id: input.propiedadId } });
      if (!propiedad) {
        throw new ApiError(404, "NOT_FOUND", "Propiedad no encontrada");
      }

      const lastHistorial = await tx.historialPago.findFirst({
        where: { propiedad_id: input.propiedadId },
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
      });
      const saldoAnterior =
        lastHistorial != null
          ? Number(lastHistorial.monto_a_la_fecha)
          : Number(propiedad.monto_a_la_fecha);
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
          propiedad_id: input.propiedadId,
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

      await tx.propiedad.update({
        where: { id: input.propiedadId },
        data: { monto_a_la_fecha: saldoNuevo },
      });

      await refreshPropiedadMoraAggregates(tx, input.propiedadId);

      return historial;
    })) as unknown as HistorialPago;
  }

  async deleteHistorialPagoAndUpdateSaldo(input: {
    propiedadId: string;
    historialId: string;
  }): Promise<void> {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const historial = await tx.historialPago.findUnique({ where: { id: input.historialId } });
      if (!historial || historial.propiedad_id !== input.propiedadId) {
        throw new ApiError(404, "NOT_FOUND", "Historial no encontrado para la propiedad");
      }

      await tx.historialPago.delete({ where: { id: input.historialId } });
      await recomputeHistorialSaldosForPropiedad(tx, input.propiedadId);
    });
  }

  async updateHistorialPagoAndUpdateSaldo(input: {
    propiedadId: string;
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
      const historial = await tx.historialPago.findUnique({ where: { id: input.historialId } });
      if (!historial || historial.propiedad_id !== input.propiedadId) {
        throw new ApiError(404, "NOT_FOUND", "Historial no encontrado para la propiedad");
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

      await recomputeHistorialSaldosForPropiedad(tx, input.propiedadId);

      const updated = await tx.historialPago.findUnique({ where: { id: input.historialId } });
      return updated!;
    })) as unknown as HistorialPago;
  }

  async listGestionesByPropiedadId(propiedadId: string): Promise<Gestion[]> {
    return (await prisma.gestion.findMany({
      where: { propiedad_id: propiedadId },
      orderBy: { fecha: "desc" },
    })) as unknown as Gestion[];
  }

  async createGestionForPropiedad(input: {
    propiedadId: string;
    fecha: string;
    estado: string;
    descripcion: string;
  }): Promise<Gestion> {
    return (await prisma.gestion.create({
      data: {
        propiedad_id: input.propiedadId,
        fecha: parseGestionFecha(input.fecha),
        estado: input.estado,
        descripcion: input.descripcion,
      },
    })) as unknown as Gestion;
  }

  async updateGestionForPropiedad(input: {
    propiedadId: string;
    gestionId: string;
    fecha?: string;
    estado?: string;
    descripcion?: string;
  }): Promise<Gestion> {
    const gestion = await prisma.gestion.findUnique({ where: { id: input.gestionId } });
    if (!gestion || gestion.propiedad_id !== input.propiedadId) {
      throw new ApiError(404, "NOT_FOUND", "Gestion no encontrada para la propiedad");
    }
    assertGestionMutable(gestion);

    return (await prisma.gestion.update({
      where: { id: input.gestionId },
      data: {
        ...(input.fecha != null ? { fecha: parseGestionFecha(input.fecha) } : {}),
        ...(input.estado != null ? { estado: input.estado } : {}),
        ...(input.descripcion != null ? { descripcion: input.descripcion } : {}),
      },
    })) as unknown as Gestion;
  }

  async deleteGestionForPropiedad(input: {
    propiedadId: string;
    gestionId: string;
  }): Promise<void> {
    const gestion = await prisma.gestion.findUnique({ where: { id: input.gestionId } });
    if (!gestion || gestion.propiedad_id !== input.propiedadId) {
      throw new ApiError(404, "NOT_FOUND", "Gestion no encontrada para la propiedad");
    }
    assertGestionMutable(gestion);

    await prisma.gestion.delete({ where: { id: input.gestionId } });
  }
}

