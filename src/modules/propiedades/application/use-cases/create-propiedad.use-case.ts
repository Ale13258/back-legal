import type {
  PropiedadesPersistencePort,
  Propiedad,
  TipoPropiedad,
} from "../../domain/ports/propiedades-persistence.port.js";

export class CreatePropiedadUseCase {
  constructor(private readonly deps: { propiedadesPersistence: PropiedadesPersistencePort }) {}

  async execute(input: {
    cliente_id: string;
    tipo_propiedad: TipoPropiedad;
    identificador: string;
    direccion?: string;
    notas?: string;
    saldo_inicial?: number;
  }): Promise<Propiedad> {
    return this.deps.propiedadesPersistence.createPropiedad({
      ...input,
    });
  }
}

