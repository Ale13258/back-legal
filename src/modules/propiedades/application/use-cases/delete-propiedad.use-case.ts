import { ApiError } from "../../../../shared/http/error-handler.js";
import type { PropiedadesPersistencePort } from "../../domain/ports/propiedades-persistence.port.js";

export class DeletePropiedadUseCase {
  constructor(private readonly deps: { propiedadesPersistence: PropiedadesPersistencePort }) {}

  async execute(input: { id: string }): Promise<void> {
    const propiedad = await this.deps.propiedadesPersistence.getPropiedadById(input.id);
    if (!propiedad) {
      throw new ApiError(404, "NOT_FOUND", "Propiedad no encontrada");
    }

    await this.deps.propiedadesPersistence.deletePropiedadCascade(input.id);
  }
}
