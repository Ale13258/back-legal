import { ApiError } from "../../../../shared/http/error-handler.js";
import type { NotificationsPersistencePort } from "../../domain/ports/notifications-persistence.port.js";
import type { NotificationChannel, NotificationEvent, NotificationStage } from "../../domain/notifications.types.js";

function buildIdempotencyKey(input: { propiedad_id: string; stage: NotificationStage; due_date: string }) {
  return `${input.propiedad_id}:${input.stage}:${input.due_date}`;
}

function parseYmdToUtcNoon(ymd: string): Date {
  return new Date(`${ymd}T12:00:00.000Z`);
}

export class SendNotificationUseCase {
  constructor(
    private readonly deps: {
      notificationsPersistence: NotificationsPersistencePort;
    },
  ) {}

  async execute(input: {
    channel: NotificationChannel;
    propiedad_id: string;
    stage: NotificationStage;
    due_date: string;
    idempotency_key?: string;
  }): Promise<NotificationEvent> {
    const propiedad = await this.deps.notificationsPersistence.findPropiedadWithCliente(input.propiedad_id);
    if (!propiedad) {
      throw new ApiError(404, "NOT_FOUND", "Propiedad no encontrada");
    }
    if (propiedad.monto_a_la_fecha <= 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "La propiedad no es elegible para notificación");
    }
    if (!propiedad.cliente.telefono) {
      throw new ApiError(400, "VALIDATION_ERROR", "El cliente no tiene teléfono configurado");
    }

    const idempotency_key =
      input.idempotency_key ??
      buildIdempotencyKey({
        propiedad_id: input.propiedad_id,
        stage: input.stage,
        due_date: input.due_date,
      });

    const scheduled_for = parseYmdToUtcNoon(input.due_date);

    try {
      return await this.deps.notificationsPersistence.createEventWithSequence({
        propiedad_id: input.propiedad_id,
        due_date: input.due_date,
        stage: input.stage,
        channel: input.channel,
        idempotency_key,
        scheduled_for,
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "CONFLICT") {
        const existing =
          await this.deps.notificationsPersistence.findEventByIdempotencyKey(idempotency_key);
        if (existing) return existing;
      }
      throw error;
    }
  }
}
