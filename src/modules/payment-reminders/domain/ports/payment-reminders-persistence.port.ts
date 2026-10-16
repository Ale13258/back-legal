export type CuentaForReminder = {
  id: string;
  identificador: string;
  direccion: string | null;
  monto_a_la_fecha: number;
  cobro_nombre: string;
  cobro_email: string | null;
};

export type ReminderGestionRecord = {
  id: string;
  cuenta_id: string;
  fecha: Date;
  tipo: "email_reminder";
  estado: string;
  descripcion: string;
  created_at: Date;
  updated_at: Date;
};

export interface PaymentRemindersPersistencePort {
  findCuentaForReminder(cuentaId: string): Promise<CuentaForReminder | null>;
  /** Crea el evento de gestión con el correo completo en `descripcion`. */
  createSentEmailGestion(input: {
    cuenta_id: string;
    sent_at: Date;
    descripcion: string;
  }): Promise<ReminderGestionRecord>;
  findEmailGestionById(id: string): Promise<ReminderGestionRecord | null>;
  listEmailGestionesByCuenta(
    cuentaId: string,
    limit: number,
  ): Promise<ReminderGestionRecord[]>;
}
