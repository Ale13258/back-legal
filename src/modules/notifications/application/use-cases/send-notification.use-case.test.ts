import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../../../../shared/http/error-handler.js";
import { SendNotificationUseCase } from "./send-notification.use-case.js";
import type { NotificationsPersistencePort } from "../../domain/ports/notifications-persistence.port.js";

function createBasePersistence(): NotificationsPersistencePort {
  return {
    async findPropiedadWithCliente() {
      return {
        id: "prop-1",
        identificador: "A-101",
        monto_a_la_fecha: 1000,
        cliente: { id: "cl-1", nombre: "Ana", telefono: "3013322950" },
      };
    },
    async createEventWithSequence(input: {
      propiedad_id: string;
      due_date: string;
      stage: "d_minus_3" | "d_day_0" | "d_plus_3";
      channel: "whatsapp";
      idempotency_key: string;
      scheduled_for: Date;
    }) {
      return {
        id: "evt-1",
        sequence_id: "seq-1",
        propiedad_id: input.propiedad_id,
        stage: input.stage,
        channel: input.channel,
        status: "queued",
        scheduled_for: input.scheduled_for,
        sent_at: null,
        delivered_at: null,
        read_at: null,
        provider_message_id: null,
        error_code: null,
        error_message: null,
        idempotency_key: input.idempotency_key,
        created_at: new Date(),
        updated_at: new Date(),
      };
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
      return { isDuplicate: false };
    },
    async applyWebhookStatus() {},
    async countEventsByStatusSince() {
      return 0;
    },
  };
}

test("send-notification genera idempotency key por defecto", async () => {
  const persistence = createBasePersistence();
  const useCase = new SendNotificationUseCase({ notificationsPersistence: persistence });
  const result = await useCase.execute({
    channel: "whatsapp",
    propiedad_id: "prop-1",
    stage: "d_day_0",
    due_date: "2026-04-14",
  });

  assert.equal(result.idempotency_key, "prop-1:d_day_0:2026-04-14");
  assert.equal(result.status, "queued");
});

test("send-notification falla si propiedad no es elegible", async () => {
  const persistence = createBasePersistence();
  persistence.findPropiedadWithCliente = async () => ({
    id: "prop-1",
    identificador: "A-101",
    monto_a_la_fecha: 0,
    cliente: { id: "cl-1", nombre: "Ana", telefono: "3013322950" },
  });

  const useCase = new SendNotificationUseCase({ notificationsPersistence: persistence });
  await assert.rejects(
    () =>
      useCase.execute({
        channel: "whatsapp",
        propiedad_id: "prop-1",
        stage: "d_day_0",
        due_date: "2026-04-14",
      }),
    (error: unknown) => error instanceof ApiError && error.code === "VALIDATION_ERROR",
  );
});

test("send-notification devuelve evento existente en duplicado", async () => {
  const persistence = createBasePersistence();
  persistence.createEventWithSequence = async () => {
    throw new ApiError(409, "CONFLICT", "Idempotency key duplicada");
  };
  persistence.findEventByIdempotencyKey = async () => ({
    id: "evt-existing",
    sequence_id: "seq-1",
    propiedad_id: "prop-1",
    stage: "d_day_0",
    channel: "whatsapp",
    status: "queued",
    scheduled_for: new Date("2026-04-14T12:00:00.000Z"),
    sent_at: null,
    delivered_at: null,
    read_at: null,
    provider_message_id: null,
    error_code: null,
    error_message: null,
    idempotency_key: "prop-1:d_day_0:2026-04-14",
    created_at: new Date(),
    updated_at: new Date(),
  });

  const useCase = new SendNotificationUseCase({ notificationsPersistence: persistence });
  const result = await useCase.execute({
    channel: "whatsapp",
    propiedad_id: "prop-1",
    stage: "d_day_0",
    due_date: "2026-04-14",
  });
  assert.equal(result.id, "evt-existing");
});
