import { ApiError } from "../../../../shared/http/error-handler.js";
import type {
  AuthContext,
  CuentasPersistencePort,
  Cuenta,
} from "../../domain/ports/cuentas-persistence.port.js";

export class GetCuentaUseCase {
  constructor(private readonly deps: { cuentasPersistence: CuentasPersistencePort }) {}

  async execute(input: { auth: AuthContext; cuentaId: string }): Promise<Cuenta> {
    const cuenta = await this.deps.cuentasPersistence.getCuentaById(input.cuentaId);
    if (!cuenta) {
      throw new ApiError(404, "NOT_FOUND", "Cuenta no encontrada");
    }

    if (input.auth.role === "cliente" && input.auth.cliente_id !== cuenta.cliente_id) {
      throw new ApiError(403, "FORBIDDEN", "Recurso fuera de alcance");
    }

    return cuenta;
  }
}

