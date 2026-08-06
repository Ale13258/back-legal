import { ApiError } from "../../../../shared/http/error-handler.js";
import type {
  ConceptoPago,
  EstadoPago,
  HistorialPago,
  CuentasPersistencePort,
} from "../../domain/ports/cuentas-persistence.port.js";

export class UpdateHistorialPagoUseCase {
  constructor(private readonly deps: { cuentasPersistence: CuentasPersistencePort }) {}

  async execute(input: {
    cuentaId: string;
    historialId: string;
    periodo: string;
    concepto: ConceptoPago;
    valor_cobrado: number;
    valor_pagado: number;
    fecha_pago?: string | null;
    estado_pago: EstadoPago;
    observaciones?: string;
    fecha_inicio_cobro?: string | null;
    fecha_fin_cobro?: string | null;
  }): Promise<HistorialPago> {
    const cuenta = await this.deps.cuentasPersistence.getCuentaById(input.cuentaId);
    if (!cuenta) {
      throw new ApiError(404, "NOT_FOUND", "Cuenta no encontrada");
    }

    return this.deps.cuentasPersistence.updateHistorialPagoAndUpdateSaldo({
      cuentaId: input.cuentaId,
      historialId: input.historialId,
      periodo: input.periodo,
      concepto: input.concepto,
      valor_cobrado: input.valor_cobrado,
      valor_pagado: input.valor_pagado,
      fecha_pago: input.fecha_pago,
      estado_pago: input.estado_pago,
      observaciones: input.observaciones,
      fecha_inicio_cobro: input.fecha_inicio_cobro,
      fecha_fin_cobro: input.fecha_fin_cobro,
    });
  }
}
