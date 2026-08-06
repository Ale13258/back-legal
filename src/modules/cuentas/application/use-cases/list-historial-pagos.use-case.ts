import { ApiError } from "../../../../shared/http/error-handler.js";
import type {
  AuthContext,
  HistorialPago,
  CuentasPersistencePort,
} from "../../domain/ports/cuentas-persistence.port.js";

export class ListHistorialPagosUseCase {
  constructor(private readonly deps: { cuentasPersistence: CuentasPersistencePort }) {}

  async execute(input: { auth: AuthContext; cuentaId: string }): Promise<HistorialPago[]> {
    const cuenta = await this.deps.cuentasPersistence.getCuentaById(input.cuentaId);
    if (!cuenta) {
      throw new ApiError(404, "NOT_FOUND", "Cuenta no encontrada");
    }

    if (input.auth.role === "cliente" && input.auth.cliente_id !== cuenta.cliente_id) {
      throw new ApiError(403, "FORBIDDEN", "Recurso fuera de alcance");
    }

    return this.deps.cuentasPersistence.listHistorialPagosByCuentaId(input.cuentaId);
  }
}

