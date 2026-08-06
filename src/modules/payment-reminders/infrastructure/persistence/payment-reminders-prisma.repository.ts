import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import { GESTION_TIPO_EMAIL_REMINDER } from "../../domain/normalize-recipients.js";
import type {
  PaymentRemindersPersistencePort,
  CuentaForReminder,
  ReminderGestionRecord,
} from "../../domain/ports/payment-reminders-persistence.port.js";

function mapGestion(row: {
  id: string;
  cuenta_id: string;
  fecha: Date;
  tipo: string;
  estado: string;
  descripcion: string;
  created_at: Date;
  updated_at: Date;
}): ReminderGestionRecord {
  return {
    id: row.id,
    cuenta_id: row.cuenta_id,
    fecha: row.fecha,
    tipo: "email_reminder",
    estado: row.estado,
    descripcion: row.descripcion,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class PaymentRemindersPrismaRepository implements PaymentRemindersPersistencePort {
  async findCuentaForReminder(cuentaId: string): Promise<CuentaForReminder | null> {
    const row = await prisma.cuenta.findFirst({
      where: { id: cuentaId, deleted_at: null },
      select: {
        id: true,
        identificador: true,
        direccion: true,
        monto_a_la_fecha: true,
        cobro_nombre: true,
        cobro_email: true,
      },
    });
    if (!row) return null;

    const lastHistorial = await prisma.historialPago.findFirst({
      where: { cuenta_id: cuentaId, deleted_at: null },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
    });
    const monto_a_la_fecha =
      lastHistorial != null
        ? Number(lastHistorial.monto_a_la_fecha)
        : Number(row.monto_a_la_fecha);

    return {
      id: row.id,
      identificador: row.identificador,
      direccion: row.direccion,
      monto_a_la_fecha,
      cobro_nombre: row.cobro_nombre,
      cobro_email: row.cobro_email,
    };
  }

  async createSentEmailGestion(input: {
    cuenta_id: string;
    sent_at: Date;
    descripcion: string;
  }): Promise<ReminderGestionRecord> {
    const row = await prisma.gestion.create({
      data: {
        cuenta_id: input.cuenta_id,
        fecha: input.sent_at,
        tipo: GESTION_TIPO_EMAIL_REMINDER,
        estado: "enviado",
        descripcion: input.descripcion,
      },
    });
    return mapGestion(row);
  }

  async findEmailGestionById(id: string): Promise<ReminderGestionRecord | null> {
    const row = await prisma.gestion.findFirst({
      where: { id, tipo: GESTION_TIPO_EMAIL_REMINDER },
    });
    return row ? mapGestion(row) : null;
  }

  async listEmailGestionesByCuenta(
    cuentaId: string,
    limit: number,
  ): Promise<ReminderGestionRecord[]> {
    const rows = await prisma.gestion.findMany({
      where: { cuenta_id: cuentaId, tipo: GESTION_TIPO_EMAIL_REMINDER },
      orderBy: { fecha: "desc" },
      take: limit,
    });
    return rows.map(mapGestion);
  }
}
