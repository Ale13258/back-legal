import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import { ApiError } from "../../../../shared/http/error-handler.js";
import { Prisma } from "@prisma/client";
import { getBusinessTodayYmd } from "../../domain/business-calendar.js";
import { computeDiasEnMora } from "../../domain/mora.js";
import { refreshPropiedadMoraAggregates } from "./refresh-mora-aggregates.js";
import type {
  ConceptoPago,
  EstadoPago,
  HistorialPago,
  PropiedadesPersistencePort,
  Propiedad,
  Gestion,
  TipoPropiedad,
} from "../../domain/ports/propiedades-persistence.port.js";

function cobroDateFromInput(value: string | null | undefined): Date | null {
  if (value === undefined || value === null) return null;
  return new Date(`${value}T12:00:00.000Z`);
}

function fechaPagoFromInput(value: string | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T12:00:00.000Z`);
}

export class PropiedadesPrismaRepository implements PropiedadesPersistencePort {
  async listPropiedades(input: {
    cliente_id?: string | undefined;
    tipo_propiedad?: TipoPropiedad | undefined;
  }): Promise<Propiedad[]> {
    return prisma.propiedad.findMany({
      where: {
        ...(input.cliente_id ? { cliente_id: input.cliente_id } : {}),
        ...(input.tipo_propiedad ? { tipo_propiedad: input.tipo_propiedad } : {}),
      },
      orderBy: { created_at: "desc" },
    }) as unknown as Propiedad[];
  }

  async getPropiedadById(id: string): Promise<Propiedad | null> {
    return (await prisma.propiedad.findUnique({ where: { id } })) as unknown as Propiedad | null;
  }

  async createPropiedad(input: {
    cliente_id: string;
    tipo_propiedad: TipoPropiedad;
    identificador: string;
    direccion?: string | undefined;
    notas?: string | undefined;
    saldo_inicial?: number | undefined;
  }): Promise<Propiedad> {
    return (await prisma.propiedad.create({
      data: {
        cliente_id: input.cliente_id,
        tipo_propiedad: input.tipo_propiedad,
        identificador: input.identificador,
        direccion: input.direccion,
        notas: input.notas,
        monto_a_la_fecha: input.saldo_inicial ?? 0,
      },
    })) as unknown as Propiedad;
  }

  async updatePropiedad(input: {
    id: string;
    tipo_propiedad?: TipoPropiedad | undefined;
    identificador?: string | undefined;
    direccion?: string | undefined;
    notas?: string | undefined;
    saldo_inicial?: number | undefined;
  }): Promise<Propiedad> {
    const data: {
      tipo_propiedad?: TipoPropiedad;
      identificador?: string;
      direccion?: string;
      notas?: string;
      monto_a_la_fecha?: number;
    } = {};

    if (input.tipo_propiedad !== undefined) data.tipo_propiedad = input.tipo_propiedad;
    if (input.identificador !== undefined) data.identificador = input.identificador;
    if (input.direccion !== undefined) data.direccion = input.direccion;
    if (input.notas !== undefined) data.notas = input.notas;
    if (input.saldo_inicial !== undefined) data.monto_a_la_fecha = input.saldo_inicial;

    return (await prisma.propiedad.update({
      where: { id: input.id },
      data,
    })) as unknown as Propiedad;
  }

  async deletePropiedadCascade(id: string): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.historialPago.deleteMany({ where: { propiedad_id: id } });
        await tx.gestion.deleteMany({ where: { propiedad_id: id } });
        await tx.propiedad.delete({ where: { id } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new ApiError(404, "NOT_FOUND", "Propiedad no encontrada");
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
    fecha_pago?: string | undefined;
    estado_pago: EstadoPago;
    observaciones?: string | undefined;
    fecha_inicio_cobro?: string | null;
    fecha_fin_cobro?: string | null;
  }): Promise<HistorialPago> {
    return (await prisma.$transaction(async (tx) => {
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
    await prisma.$transaction(async (tx) => {
      const historial = await tx.historialPago.findUnique({ where: { id: input.historialId } });
      if (!historial || historial.propiedad_id !== input.propiedadId) {
        throw new ApiError(404, "NOT_FOUND", "Historial no encontrado para la propiedad");
      }

      await tx.historialPago.delete({ where: { id: input.historialId } });

      const last = await tx.historialPago.findFirst({
        where: { propiedad_id: input.propiedadId },
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
      });

      await tx.propiedad.update({
        where: { id: input.propiedadId },
        data: { monto_a_la_fecha: Number(last?.monto_a_la_fecha ?? 0) },
      });

      await refreshPropiedadMoraAggregates(tx, input.propiedadId);
    });
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
        fecha: new Date(input.fecha),
        estado: input.estado,
        descripcion: input.descripcion,
      },
    })) as unknown as Gestion;
  }
}

