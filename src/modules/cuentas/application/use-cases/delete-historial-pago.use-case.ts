import { ApiError } from "../../../../shared/http/error-handler.js";
import type { CuentasPersistencePort } from "../../domain/ports/cuentas-persistence.port.js";

export class DeleteHistorialPagoUseCase {
  constructor(private readonly deps: { cuentasPersistence: CuentasPersistencePort }) {}

  async execute(input: { cuentaId: string; historialId: string }): Promise<void> {
    const cuenta = await this.deps.cuentasPersistence.getCuentaById(input.cuentaId);
    if (!cuenta) {
      throw new ApiError(404, "NOT_FOUND", "Cuenta no encontrada");
    }

    await this.deps.cuentasPersistence.deleteHistorialPagoAndUpdateSaldo({
      cuentaId: input.cuentaId,
      historialId: input.historialId,
    });
  }
}
