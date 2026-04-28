import { ApiError } from "../../../../shared/http/error-handler.js";
import type {
  AuthContext,
  HistorialPago,
  PropiedadesPersistencePort,
} from "../../domain/ports/propiedades-persistence.port.js";

export class ListHistorialPagosUseCase {
  constructor(private readonly deps: { propiedadesPersistence: PropiedadesPersistencePort }) {}

  async execute(input: { auth: AuthContext; propiedadId: string }): Promise<HistorialPago[]> {
    const propiedad = await this.deps.propiedadesPersistence.getPropiedadById(input.propiedadId);
    if (!propiedad) {
      throw new ApiError(404, "NOT_FOUND", "Propiedad no encontrada");
    }

    if (input.auth.role === "cliente" && input.auth.cliente_id !== propiedad.cliente_id) {
      throw new ApiError(403, "FORBIDDEN", "Recurso fuera de alcance");
    }

    return this.deps.propiedadesPersistence.listHistorialPagosByPropiedadId(input.propiedadId);
  }
}

