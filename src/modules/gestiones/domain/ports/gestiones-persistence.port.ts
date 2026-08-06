export type Gestion = {
  id: string;
  cuenta_id: string;
  fecha: Date;
  tipo: "manual" | "email_reminder";
  estado: string;
  /** Manual: texto. Correo: JSON con subject, body_html, etc. */
  descripcion: string;
  created_at: Date;
  updated_at: Date;
};

export interface GestionesPersistencePort {
  listGestiones(): Promise<Gestion[]>;
}
