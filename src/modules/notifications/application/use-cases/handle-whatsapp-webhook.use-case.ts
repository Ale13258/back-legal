import type { NotificationsPersistencePort } from "../../domain/ports/notifications-persistence.port.js";
import type { WhatsAppWebhookPayload } from "../../domain/notifications.types.js";

export class HandleWhatsAppWebhookUseCase {
  constructor(
    private readonly deps: {
      notificationsPersistence: NotificationsPersistencePort;
    },
  ) {}

  async execute(payload: WhatsAppWebhookPayload): Promise<void> {
    const dedupe = await this.deps.notificationsPersistence.persistWebhookEvent(payload);
    if (dedupe.isDuplicate) return;
    await this.deps.notificationsPersistence.applyWebhookStatus(payload);
  }
}
