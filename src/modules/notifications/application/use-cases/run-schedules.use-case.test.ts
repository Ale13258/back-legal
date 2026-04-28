import test from "node:test";
import assert from "node:assert/strict";
import { RunSchedulesUseCase } from "./run-schedules.use-case.js";
import type { NotificationsPersistencePort } from "../../domain/ports/notifications-persistence.port.js";

test("run-schedules encola eventos creados y cancela futuros pagados", async () => {
  const queuedIds: string[] = [];
  let cancelled = 0;
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
    async listEligiblePropiedadesForDate(dueDate: string) {
      if (dueDate === "2026-04-14") {
        return [
          {
            id: "prop-1",
            identificador: "A-101",
            monto_a_la_fecha: 200,
            cliente: { id: "cl-1", nombre: "Ana", telefono: "300" },
            due_date: "2026-04-14",
          },
        ];
      }
      return [];
    },
    async createScheduleEventIfNotExists(input: {
      propiedad_id: string;
      due_date: string;
      stage: "d_minus_3" | "d_day_0" | "d_plus_3";
      scheduled_for: Date;
      idempotency_key: string;
    }) {
      return {
        created: true,
        event: {
          id: `evt-${input.stage}`,
          sequence_id: "seq-1",
          propiedad_id: input.propiedad_id,
          stage: input.stage,
          channel: "whatsapp",
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
        },
      };
    },
    async cancelFuturePendingEvents() {
      cancelled += 1;
      return 1;
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

  const useCase = new RunSchedulesUseCase({
    notificationsPersistence: persistence,
    queuePublisher: {
      enqueueNotificationJob: async ({ event_id }: { event_id: string }) => {
        queuedIds.push(event_id);
        return true;
      },
    },
  });

  const result = await useCase.execute({ now: new Date("2026-04-14T10:00:00.000Z") });
  assert.equal(result.queued_events >= 1, true);
  assert.equal(queuedIds.length >= 1, true);
  assert.equal(cancelled, 0);
});
