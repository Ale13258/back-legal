import { ApiError } from "../../../../shared/http/error-handler.js";
import type { PropiedadesPersistencePort } from "../../domain/ports/propiedades-persistence.port.js";

export class DeleteHistorialPagoUseCase {
  constructor(private readonly deps: { propiedadesPersistence: PropiedadesPersistencePort }) {}

  async execute(input: { propiedadId: string; historialId: string }): Promise<void> {
    const propiedad = await this.deps.propiedadesPersistence.getPropiedadById(input.propiedadId);
    if (!propiedad) {
      throw new ApiError(404, "NOT_FOUND", "Propiedad no encontrada");
    }

    await this.deps.propiedadesPersistence.deleteHistorialPagoAndUpdateSaldo({
      propiedadId: input.propiedadId,
      historialId: input.historialId,
    });
  }
}
