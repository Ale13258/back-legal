import type {
  DeudorCobro,
  PropiedadesPersistencePort,
  Propiedad,
  TipoPersona,
  TipoPropiedad,
} from "../../domain/ports/propiedades-persistence.port.js";

export class UpdatePropiedadUseCase {
  constructor(private readonly deps: { propiedadesPersistence: PropiedadesPersistencePort }) {}

  async execute(input: {
    id: string;
    tipo_propiedad?: TipoPropiedad;
    identificador?: string;
    direccion?: string;
    notas?: string;
    saldo_inicial?: number;
    deudores?: DeudorCobro[];
    cobro_nombre?: string;
    cobro_tipo_persona?: TipoPersona;
    cobro_documento?: string;
    cobro_email?: string;
    fecha_inicio_cobro?: string | null;
  }): Promise<Propiedad> {
    return this.deps.propiedadesPersistence.updatePropiedad(input);
  }
}

