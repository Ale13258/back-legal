import { ApiError } from "../../../../shared/http/error-handler.js";
import type {
  Gestion,
  CuentasPersistencePort,
} from "../../domain/ports/cuentas-persistence.port.js";

export class UpdateGestionUseCase {
  constructor(private readonly deps: { cuentasPersistence: CuentasPersistencePort }) {}

  async execute(input: {
    cuentaId: string;
    gestionId: string;
    fecha?: string;
    estado?: string;
    descripcion?: string;
  }): Promise<Gestion> {
    const cuenta = await this.deps.cuentasPersistence.getCuentaById(input.cuentaId);
    if (!cuenta) {
      throw new ApiError(404, "NOT_FOUND", "Cuenta no encontrada");
    }

    return this.deps.cuentasPersistence.updateGestionForCuenta({
      cuentaId: input.cuentaId,
      gestionId: input.gestionId,
      fecha: input.fecha,
      estado: input.estado,
      descripcion: input.descripcion,
    });
  }
}
