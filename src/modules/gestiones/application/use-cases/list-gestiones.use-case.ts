import type { GestionesPersistencePort, Gestion } from "../../domain/ports/gestiones-persistence.port.js";

export class ListGestionesUseCase {
  constructor(private readonly deps: { gestionesPersistence: GestionesPersistencePort }) {}

  async execute(): Promise<Gestion[]> {
    return this.deps.gestionesPersistence.listGestiones();
  }
}

