import type {
  DeudorCobro,
  CuentasPersistencePort,
  Cuenta,
  TipoPersona,
  TipoCuenta,
} from "../../domain/ports/cuentas-persistence.port.js";

export class UpdateCuentaUseCase {
  constructor(private readonly deps: { cuentasPersistence: CuentasPersistencePort }) {}

  async execute(input: {
    id: string;
    tipo_cuenta?: TipoCuenta;
    identificador?: string;
    direccion?: string;
    notas?: string;
    saldo_inicial?: number;
    deudores?: DeudorCobro[];
    cobro_nombre?: string;
    cobro_tipo_persona?: TipoPersona;
    cobro_documento?: string;
    cobro_email?: string;
    fecha_inicio_cobro?: string | null;
  }): Promise<Cuenta> {
    return this.deps.cuentasPersistence.updateCuenta(input);
  }
}

