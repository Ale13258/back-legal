import { ApiError } from "../../../../shared/http/error-handler.js";
import type { NotificationsPersistencePort } from "../../domain/ports/notifications-persistence.port.js";
import type { NotificationChannel, NotificationEvent } from "../../domain/notifications.types.js";

export class ListNotificationEventsUseCase {
  constructor(
    private readonly deps: {
      notificationsPersistence: NotificationsPersistencePort;
    },
  ) {}

  async execute(input: {
    propiedad_id: string;
    channel: NotificationChannel;
    limit: number;
    sort: "created_at" | "scheduled_for";
    order: "asc" | "desc";
  }): Promise<{ items: NotificationEvent[] }> {
    const propiedad = await this.deps.notificationsPersistence.findPropiedadWithCliente(input.propiedad_id);
    if (!propiedad) {
      throw new ApiError(404, "NOT_FOUND", "Propiedad no encontrada");
    }

    const items = await this.deps.notificationsPersistence.listEventsByPropiedad(input);
    return { items };
  }
}
