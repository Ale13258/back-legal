import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import { GESTION_ORIGEN_EMAIL_REMINDER, normalizeReminderRecipients } from "../../domain/normalize-recipients.js";
import type {
  PaymentReminderEmailRecord,
  PaymentReminderEmailWithBody,
  PaymentRemindersPersistencePort,
  PropiedadForReminder,
} from "../../domain/ports/payment-reminders-persistence.port.js";

type PaymentReminderEmailRow = {
  id: string;
  propiedad_id: string;
  cliente_email: string;
  extra_recipients: string[];
  subject: string;
  status: string;
  provider_id: string | null;
  error_message: string | null;
  sent_at: Date | null;
  created_at: Date;
  body_html?: string | null;
  body_text?: string | null;
  gestion?: { id: string } | null;
};

function mapRecord(row: PaymentReminderEmailRow): PaymentReminderEmailRecord {
  const recipients = normalizeReminderRecipients(row.cliente_email, row.extra_recipients);
  return {
    id: row.id,
    propiedad_id: row.propiedad_id,
    cliente_email: recipients.cliente_email,
    extra_recipients: recipients.extra_recipients,
    subject: row.subject,
    status: row.status,
    provider_id: row.provider_id,
    error_message: row.error_message,
    sent_at: row.sent_at,
    created_at: row.created_at,
    gestion_id: row.gestion?.id ?? null,
  };
}

function mapRecordWithBody(row: PaymentReminderEmailRow): PaymentReminderEmailWithBody {
  return {
    ...mapRecord(row),
    body_html: row.body_html ?? null,
    body_text: row.body_text ?? null,
  };
}

const emailSelect = {
  id: true,
  propiedad_id: true,
  cliente_email: true,
  extra_recipients: true,
  subject: true,
  status: true,
  provider_id: true,
  error_message: true,
  sent_at: true,
  created_at: true,
  body_html: true,
  body_text: true,
  gestion: { select: { id: true } },
} as const;

export class PaymentRemindersPrismaRepository implements PaymentRemindersPersistencePort {
  async findPropiedadForReminder(propiedadId: string): Promise<PropiedadForReminder | null> {
    const row = await prisma.propiedad.findUnique({
      where: { id: propiedadId },
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
      where: { propiedad_id: propiedadId },
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

  async createQueued(input: {
    propiedad_id: string;
    cliente_email: string;
    extra_recipients: string[];
    subject: string;
    body_html: string;
    body_text: string;
  }): Promise<PaymentReminderEmailRecord> {
    const row = await prisma.paymentReminderEmail.create({
      data: {
        propiedad_id: input.propiedad_id,
        cliente_email: input.cliente_email,
        extra_recipients: input.extra_recipients,
        subject: input.subject,
        body_html: input.body_html,
        body_text: input.body_text,
        status: "queued",
      },
      select: emailSelect,
    });
    return mapRecord(row);
  }

  async markSentWithGestion(input: {
    id: string;
    provider_id: string;
    sent_at: Date;
    propiedad_id: string;
    descripcion: string;
  }): Promise<PaymentReminderEmailWithBody> {
    return prisma.$transaction(async (tx) => {
      const email = await tx.paymentReminderEmail.update({
        where: { id: input.id },
        data: {
          status: "sent",
          provider_id: input.provider_id,
          sent_at: input.sent_at,
          error_message: null,
        },
        select: emailSelect,
      });

      const gestion = await tx.gestion.create({
        data: {
          propiedad_id: input.propiedad_id,
          fecha: input.sent_at,
          estado: "enviado",
          descripcion: input.descripcion,
          origen: GESTION_ORIGEN_EMAIL_REMINDER,
          email_reminder_id: email.id,
        },
        select: { id: true },
      });

      return mapRecordWithBody({ ...email, gestion });
    });
  }

  async markFailed(input: {
    id: string;
    error_message: string;
  }): Promise<PaymentReminderEmailRecord> {
    const row = await prisma.paymentReminderEmail.update({
      where: { id: input.id },
      data: {
        status: "failed",
        error_message: input.error_message,
      },
      select: emailSelect,
    });
    return mapRecord(row);
  }

  async findById(id: string): Promise<PaymentReminderEmailWithBody | null> {
    const row = await prisma.paymentReminderEmail.findUnique({
      where: { id },
      select: emailSelect,
    });
    return row ? mapRecordWithBody(row) : null;
  }

  async listByPropiedad(
    propiedadId: string,
    limit: number,
  ): Promise<PaymentReminderEmailWithBody[]> {
    const rows = await prisma.paymentReminderEmail.findMany({
      where: { propiedad_id: propiedadId },
      orderBy: { created_at: "desc" },
      take: limit,
      select: emailSelect,
    });
    return rows.map(mapRecordWithBody);
  }
}
