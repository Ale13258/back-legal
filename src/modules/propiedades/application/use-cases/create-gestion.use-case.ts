import type {
  Gestion,
  PropiedadesPersistencePort,
} from "../../domain/ports/propiedades-persistence.port.js";

export class CreateGestionUseCase {
  constructor(private readonly deps: { propiedadesPersistence: PropiedadesPersistencePort }) {}

  async execute(input: {
    propiedadId: string;
    fecha: string;
    estado: string;
    descripcion: string;
  }): Promise<Gestion> {
    return this.deps.propiedadesPersistence.createGestionForPropiedad({
      propiedadId: input.propiedadId,
      fecha: input.fecha,
      estado: input.estado,
      descripcion: input.descripcion,
    });
  }
}

