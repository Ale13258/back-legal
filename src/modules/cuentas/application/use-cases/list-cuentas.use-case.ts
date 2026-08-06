import { ApiError } from "../../../../shared/http/error-handler.js";
import type {
  AuthContext,
  CuentasPersistencePort,
  Cuenta,
  TipoCuenta,
} from "../../domain/ports/cuentas-persistence.port.js";

export class ListCuentasUseCase {
  constructor(private readonly deps: { cuentasPersistence: CuentasPersistencePort }) {}

  async execute(input: {
    auth: AuthContext;
    cliente_id?: string;
    tipo_cuenta?: TipoCuenta;
  }): Promise<Cuenta[]> {
    const effectiveClienteId =
      input.auth.role === "cliente" && input.auth.cliente_id ? input.auth.cliente_id : input.cliente_id;

    // No valid inputs means admin asking without filters: preserve current behavior (list all)
    return this.deps.cuentasPersistence.listCuentas({
      cliente_id: effectiveClienteId,
      tipo_cuenta: input.tipo_cuenta,
    });
  }
}

