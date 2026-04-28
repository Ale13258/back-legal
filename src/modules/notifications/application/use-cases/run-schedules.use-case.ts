import type { NotificationsPersistencePort } from "../../domain/ports/notifications-persistence.port.js";
import type { NotificationStage, RunSchedulesResult } from "../../domain/notifications.types.js";

type QueuePublisher = {
  enqueueNotificationJob(input: { event_id: string }): Promise<boolean>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftYmd(baseYmd: string, days: number): string {
  const date = new Date(`${baseYmd}T00:00:00.000Z`);
  return toYmd(new Date(date.getTime() + days * DAY_MS));
}

function stageToDueDate(stage: NotificationStage, todayYmd: string): string {
  if (stage === "d_minus_3") return shiftYmd(todayYmd, 3);
  if (stage === "d_plus_3") return shiftYmd(todayYmd, -3);
  return todayYmd;
}

function stageToScheduleDate(stage: NotificationStage, dueDateYmd: string): Date {
  if (stage === "d_minus_3") return new Date(`${shiftYmd(dueDateYmd, -3)}T12:00:00.000Z`);
  if (stage === "d_plus_3") return new Date(`${shiftYmd(dueDateYmd, 3)}T12:00:00.000Z`);
  return new Date(`${dueDateYmd}T12:00:00.000Z`);
}

function idempotencyKey(propiedad_id: string, stage: NotificationStage, due_date: string): string {
  return `${propiedad_id}:${stage}:${due_date}`;
}

export class RunSchedulesUseCase {
  constructor(
    private readonly deps: {
      notificationsPersistence: NotificationsPersistencePort;
      queuePublisher: QueuePublisher;
    },
  ) {}

  async execute(input: { now?: Date }): Promise<RunSchedulesResult> {
    const now = input.now ?? new Date();
    const todayYmd = toYmd(now);
    const stages: NotificationStage[] = ["d_minus_3", "d_day_0", "d_plus_3"];

    const result: RunSchedulesResult = {
      processed_properties: 0,
      queued_events: 0,
      skipped_paid_off: 0,
      cancelled_future_events: 0,
    };

    for (const stage of stages) {
      const dueDateYmd = stageToDueDate(stage, todayYmd);
      const properties = await this.deps.notificationsPersistence.listEligiblePropiedadesForDate(dueDateYmd);

      for (const property of properties) {
        result.processed_properties += 1;
        if (property.monto_a_la_fecha <= 0) {
          result.skipped_paid_off += 1;
          result.cancelled_future_events += await this.deps.notificationsPersistence.cancelFuturePendingEvents(
            property.id,
            dueDateYmd,
          );
          continue;
        }

        const created = await this.deps.notificationsPersistence.createScheduleEventIfNotExists({
          propiedad_id: property.id,
          due_date: dueDateYmd,
          stage,
          scheduled_for: stageToScheduleDate(stage, dueDateYmd),
          idempotency_key: idempotencyKey(property.id, stage, dueDateYmd),
        });

        if (created.created && created.event) {
          const enqueued = await this.deps.queuePublisher.enqueueNotificationJob({
            event_id: created.event.id,
          });
          if (enqueued) {
            result.queued_events += 1;
          }
        }
      }
    }

    return result;
  }
}
