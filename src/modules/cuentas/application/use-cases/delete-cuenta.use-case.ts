import { ApiError } from "../../../../shared/http/error-handler.js";
import type { CuentasPersistencePort } from "../../domain/ports/cuentas-persistence.port.js";

export class DeleteCuentaUseCase {
  constructor(private readonly deps: { cuentasPersistence: CuentasPersistencePort }) {}

  async execute(input: { id: string }): Promise<void> {
    const cuenta = await this.deps.cuentasPersistence.getCuentaById(input.id);
    if (!cuenta) {
      throw new ApiError(404, "NOT_FOUND", "Cuenta no encontrada");
    }

    await this.deps.cuentasPersistence.deleteCuentaCascade(input.id);
  }
}
