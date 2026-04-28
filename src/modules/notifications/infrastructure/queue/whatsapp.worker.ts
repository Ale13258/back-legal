import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { NotificationsPrismaRepository } from "../persistence/notifications-prisma.repository.js";
import { CallbellWhatsAppProvider } from "../providers/callbell-whatsapp.provider.js";

const connection = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  retryStrategy: () => null,
  reconnectOnError: () => false,
});

connection.on("error", (error) => {
  console.error("redis_unavailable_worker", {
    message: error.message,
    redis_url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  });
});

const notificationsPersistence = new NotificationsPrismaRepository();
const provider = new CallbellWhatsAppProvider();

function templateFromStage(stage: "d_minus_3" | "d_day_0" | "d_plus_3") {
  return `reminder_${stage}`;
}

export const whatsappWorker = new Worker(
  "notifications-whatsapp",
  async (job) => {
    const eventId = String(job.data?.event_id ?? "");
    if (!eventId) return;

    await notificationsPersistence.markEventProcessing(eventId);

    const event = await notificationsPersistence.getEventPayloadForWorker(eventId);
    if (!event) {
      return;
    }
    if (!event.telefono) {
      await notificationsPersistence.markEventFailed({
        eventId,
        error_code: "MISSING_PHONE",
        error_message: "Cliente sin teléfono válido",
      });
      return;
    }

    try {
      const sent = await provider.sendTemplateMessage({
        to: event.telefono,
        template: templateFromStage(event.stage),
        variables: {
          cliente_nombre: event.cliente_nombre,
          propiedad_identificador: event.propiedad_identificador,
          monto_pendiente: event.monto_pendiente,
          fecha_corte: event.due_date,
        },
      });

      await notificationsPersistence.markEventSent({
        eventId,
        provider_message_id: sent.provider_message_id,
        sent_at: new Date(),
      });
    } catch (error) {
      await notificationsPersistence.markEventFailed({
        eventId,
        error_code: (error as Error & { code?: string }).code ?? "PROVIDER_ERROR",
        error_message: error instanceof Error ? error.message : "Error de proveedor",
      });
      throw error;
    }
  },
  { connection },
);
