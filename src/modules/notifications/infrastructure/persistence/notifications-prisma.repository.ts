import { Prisma } from "@prisma/client";
import { ApiError } from "../../../../shared/http/error-handler.js";
import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import type { NotificationsPersistencePort } from "../../domain/ports/notifications-persistence.port.js";
import type {
  NotificationChannel,
  NotificationEvent,
  NotificationStage,
  NotificationStatus,
  WhatsAppWebhookPayload,
} from "../../domain/notifications.types.js";

function asYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseYmd(ymd: string): Date {
  return new Date(`${ymd}T12:00:00.000Z`);
}

export class NotificationsPrismaRepository implements NotificationsPersistencePort {
  async findPropiedadWithCliente(propiedadId: string) {
    const row = await prisma.propiedad.findUnique({
      where: { id: propiedadId },
      include: { cliente: { select: { id: true, nombre: true, telefono: true } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      identificador: row.identificador,
      monto_a_la_fecha: Number(row.monto_a_la_fecha),
      cliente: row.cliente,
    };
  }

  async createEventWithSequence(input: {
    propiedad_id: string;
    due_date: string;
    stage: NotificationStage;
    channel: NotificationChannel;
    idempotency_key: string;
    scheduled_for: Date;
  }): Promise<NotificationEvent> {
    try {
      const event = await prisma.$transaction(async (tx) => {
        const sequence = await tx.notificationSequence.upsert({
          where: {
            id: `${input.propiedad_id}:${input.due_date}:${input.channel}`,
          },
          create: {
            id: `${input.propiedad_id}:${input.due_date}:${input.channel}`,
            propiedad_id: input.propiedad_id,
            due_date: parseYmd(input.due_date),
            channel: input.channel,
            is_active: true,
          },
          update: {
            is_active: true,
          },
        });

        return tx.notificationEvent.create({
          data: {
            sequence_id: sequence.id,
            propiedad_id: input.propiedad_id,
            stage: input.stage,
            channel: input.channel,
            idempotency_key: input.idempotency_key,
            scheduled_for: input.scheduled_for,
          },
        });
      });
      return event as unknown as NotificationEvent;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ApiError(409, "CONFLICT", "Idempotency key duplicada");
      }
      throw error;
    }
  }

  async findEventByIdempotencyKey(idempotencyKey: string): Promise<NotificationEvent | null> {
    const event = await prisma.notificationEvent.findUnique({
      where: { idempotency_key: idempotencyKey },
    });
    return (event as unknown as NotificationEvent | null) ?? null;
  }

  async findEventById(eventId: string): Promise<NotificationEvent | null> {
    const event = await prisma.notificationEvent.findUnique({
      where: { id: eventId },
    });
    return (event as unknown as NotificationEvent | null) ?? null;
  }

  async listEventsByPropiedad(input: {
    propiedad_id: string;
    channel: NotificationChannel;
    limit: number;
    sort: "created_at" | "scheduled_for";
    order: "asc" | "desc";
  }): Promise<NotificationEvent[]> {
    const items = await prisma.notificationEvent.findMany({
      where: { propiedad_id: input.propiedad_id, channel: input.channel },
      orderBy: { [input.sort]: input.order },
      take: input.limit,
    });
    return items as unknown as NotificationEvent[];
  }

  async listEligiblePropiedadesForDate(targetDateYmd: string) {
    const targetDate = parseYmd(targetDateYmd);
    const rows = await prisma.propiedad.findMany({
      where: {
        monto_a_la_fecha: { gt: 0 },
        fecha_fin_cobro: { equals: targetDate },
      },
      include: { cliente: { select: { id: true, nombre: true, telefono: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      identificador: row.identificador,
      monto_a_la_fecha: Number(row.monto_a_la_fecha),
      cliente: row.cliente,
      due_date: targetDateYmd,
    }));
  }

  async createScheduleEventIfNotExists(input: {
    propiedad_id: string;
    due_date: string;
    stage: NotificationStage;
    scheduled_for: Date;
    idempotency_key: string;
  }): Promise<{ created: boolean; event: NotificationEvent | null }> {
    try {
      const event = await this.createEventWithSequence({
        ...input,
        channel: "whatsapp",
      });
      return { created: true, event };
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        return { created: false, event: null };
      }
      throw error;
    }
  }

  async cancelFuturePendingEvents(propiedad_id: string, due_date: string): Promise<number> {
    const updated = await prisma.notificationEvent.updateMany({
      where: {
        propiedad_id,
        status: { in: ["queued", "processing"] },
        sequence: { due_date: { gt: parseYmd(due_date) } },
      },
      data: { status: "cancelled" },
    });
    return updated.count;
  }

  async getPendingEventsForWorker(limit: number) {
    const rows = await prisma.notificationEvent.findMany({
      where: { status: "queued", channel: "whatsapp", scheduled_for: { lte: new Date() } },
      include: {
        sequence: true,
        propiedad: {
          include: {
            cliente: { select: { id: true, nombre: true, telefono: true } },
          },
        },
      },
      orderBy: { scheduled_for: "asc" },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      propiedad_id: row.propiedad_id,
      stage: row.stage as NotificationStage,
      due_date: asYmd(row.sequence.due_date),
      cliente_id: row.propiedad.cliente.id,
      cliente_nombre: row.propiedad.cliente.nombre,
      telefono: row.propiedad.cliente.telefono,
      propiedad_identificador: row.propiedad.identificador,
      monto_pendiente: String(row.propiedad.monto_a_la_fecha),
    }));
  }

  async getEventPayloadForWorker(eventId: string) {
    const row = await prisma.notificationEvent.findUnique({
      where: { id: eventId },
      include: {
        sequence: true,
        propiedad: {
          include: {
            cliente: { select: { id: true, nombre: true, telefono: true } },
          },
        },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      propiedad_id: row.propiedad_id,
      stage: row.stage as NotificationStage,
      due_date: asYmd(row.sequence.due_date),
      cliente_id: row.propiedad.cliente.id,
      cliente_nombre: row.propiedad.cliente.nombre,
      telefono: row.propiedad.cliente.telefono,
      propiedad_identificador: row.propiedad.identificador,
      monto_pendiente: String(row.propiedad.monto_a_la_fecha),
    };
  }

  async markEventProcessing(eventId: string): Promise<void> {
    await prisma.notificationEvent.update({
      where: { id: eventId },
      data: { status: "processing" },
    });
  }

  async markEventSent(input: { eventId: string; provider_message_id: string; sent_at: Date }): Promise<void> {
    await prisma.notificationEvent.update({
      where: { id: input.eventId },
      data: {
        status: "sent",
        sent_at: input.sent_at,
        provider_message_id: input.provider_message_id,
        error_code: null,
        error_message: null,
      },
    });
  }

  async markEventFailed(input: {
    eventId: string;
    error_code?: string | null;
    error_message?: string | null;
  }): Promise<void> {
    await prisma.notificationEvent.update({
      where: { id: input.eventId },
      data: {
        status: "failed",
        error_code: input.error_code ?? null,
        error_message: input.error_message ?? null,
      },
    });
  }

  async persistWebhookEvent(payload: WhatsAppWebhookPayload): Promise<{ isDuplicate: boolean }> {
    const event = await prisma.notificationEvent.findFirst({
      where: { provider_message_id: payload.provider_message_id },
      select: { id: true },
    });

    try {
      await prisma.notificationWebhookEvent.create({
        data: {
          notification_event_id: event?.id,
          provider_message_id: payload.provider_message_id,
          event_type: payload.event_type,
          event_time: new Date(payload.event_time),
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });
      return { isDuplicate: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { isDuplicate: true };
      }
      throw error;
    }
  }

  async applyWebhookStatus(payload: WhatsAppWebhookPayload): Promise<void> {
    const event = await prisma.notificationEvent.findFirst({
      where: { provider_message_id: payload.provider_message_id },
    });
    if (!event) return;

    const data: Prisma.NotificationEventUpdateInput = {};
    if (payload.event_type === "delivered") {
      data.status = "delivered";
      data.delivered_at = new Date(payload.event_time);
    }
    if (payload.event_type === "read") {
      data.status = "read";
      data.read_at = new Date(payload.event_time);
    }
    if (payload.event_type === "failed") {
      data.status = "failed";
      data.error_code = payload.error_code ?? null;
      data.error_message = payload.error_message ?? null;
    }

    await prisma.notificationEvent.update({
      where: { id: event.id },
      data,
    });
  }

  async countEventsByStatusSince(status: NotificationStatus, since: Date): Promise<number> {
    return prisma.notificationEvent.count({ where: { status, created_at: { gte: since } } });
  }
}
