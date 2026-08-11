import type {
  ConceptoPago,
  EstadoPago,
  HistorialPago,
  CuentasPersistencePort,
} from "../../domain/ports/cuentas-persistence.port.js";

export class CreateHistorialPagoUseCase {
  constructor(private readonly deps: { cuentasPersistence: CuentasPersistencePort }) {}

  async execute(input: {
    cuentaId: string;
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
    return this.deps.cuentasPersistence.createHistorialPagoAndUpdateSaldo({
      cuentaId: input.cuentaId,
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

