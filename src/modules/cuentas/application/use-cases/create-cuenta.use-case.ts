import type {
  DeudorCobro,
  CuentasPersistencePort,
  Cuenta,
  TipoCuenta,
} from "../../domain/ports/cuentas-persistence.port.js";

export class CreateCuentaUseCase {
  constructor(private readonly deps: { cuentasPersistence: CuentasPersistencePort }) {}

  async execute(input: {
    cliente_id: string;
    tipo_cuenta: TipoCuenta;
    identificador: string;
    direccion?: string;
    notas?: string;
    saldo_inicial?: number;
    fecha_inicio_cobro?: string | null;
    deudores: DeudorCobro[];
  }): Promise<Cuenta> {
    return this.deps.cuentasPersistence.createCuenta({
      ...input,
    });
  }
}

