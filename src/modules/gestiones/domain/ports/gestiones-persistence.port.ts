export type Gestion = {
  id: string;
  propiedad_id: string;
  fecha: Date;
  estado: string;
  descripcion: string;
  origen: string | null;
  email_reminder_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export interface GestionesPersistencePort {
  listGestiones(): Promise<Gestion[]>;
}

