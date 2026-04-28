import test from "node:test";
import assert from "node:assert/strict";
import { HandleWhatsAppWebhookUseCase } from "./handle-whatsapp-webhook.use-case.js";
import type { NotificationsPersistencePort } from "../../domain/ports/notifications-persistence.port.js";

test("webhook deduplicado no reaplica estado", async () => {
  let applied = 0;
  const persistence: NotificationsPersistencePort = {
    async findPropiedadWithCliente() {
      return null;
    },
    async createEventWithSequence() {
      throw new Error("no usado");
    },
    async listEventsByPropiedad() {
      return [];
    },
    async findEventByIdempotencyKey() {
      return null;
    },
    async findEventById() {
      return null;
    },
    async listEligiblePropiedadesForDate() {
      return [];
    },
    async createScheduleEventIfNotExists() {
      return { created: false, event: null };
    },
    async cancelFuturePendingEvents() {
      return 0;
    },
    async getPendingEventsForWorker() {
      return [];
    },
    async getEventPayloadForWorker() {
      return null;
    },
    async markEventProcessing() {},
    async markEventSent() {},
    async markEventFailed() {},
    async persistWebhookEvent() {
      return { isDuplicate: true };
    },
    async applyWebhookStatus() {
      applied += 1;
    },
    async countEventsByStatusSince() {
      return 0;
    },
  };

  const useCase = new HandleWhatsAppWebhookUseCase({ notificationsPersistence: persistence });
  await useCase.execute({
    provider_message_id: "wamid.x",
    event_type: "delivered",
    event_time: "2026-04-14T13:00:22.000Z",
  });

  assert.equal(applied, 0);
});
