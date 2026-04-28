export type Gestion = {
  id: string;
  propiedad_id: string;
  fecha: Date;
  estado: string;
  descripcion: string;
  created_at: Date;
  updated_at: Date;
};

export interface GestionesPersistencePort {
  listGestiones(): Promise<Gestion[]>;
}

