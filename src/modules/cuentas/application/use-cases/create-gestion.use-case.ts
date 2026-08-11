import type {
  Gestion,
  CuentasPersistencePort,
} from "../../domain/ports/cuentas-persistence.port.js";

export class CreateGestionUseCase {
  constructor(private readonly deps: { cuentasPersistence: CuentasPersistencePort }) {}

  async execute(input: {
    cuentaId: string;
    fecha: string;
    estado: string;
    descripcion: string;
  }): Promise<Gestion> {
    return this.deps.cuentasPersistence.createGestionForCuenta({
      cuentaId: input.cuentaId,
      fecha: input.fecha,
      estado: input.estado,
      descripcion: input.descripcion,
    });
  }
}

