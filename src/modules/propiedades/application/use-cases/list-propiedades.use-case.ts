import { ApiError } from "../../../../shared/http/error-handler.js";
import type {
  AuthContext,
  PropiedadesPersistencePort,
  Propiedad,
  TipoPropiedad,
} from "../../domain/ports/propiedades-persistence.port.js";

export class ListPropiedadesUseCase {
  constructor(private readonly deps: { propiedadesPersistence: PropiedadesPersistencePort }) {}

  async execute(input: {
    auth: AuthContext;
    cliente_id?: string;
    tipo_propiedad?: TipoPropiedad;
  }): Promise<Propiedad[]> {
    const effectiveClienteId =
      input.auth.role === "cliente" && input.auth.cliente_id ? input.auth.cliente_id : input.cliente_id;

    // No valid inputs means admin asking without filters: preserve current behavior (list all)
    return this.deps.propiedadesPersistence.listPropiedades({
      cliente_id: effectiveClienteId,
      tipo_propiedad: input.tipo_propiedad,
    });
  }
}

