import type {
  NotificationChannel,
  NotificationEvent,
  NotificationStage,
  NotificationStatus,
  WhatsAppWebhookPayload,
} from "../notifications.types.js";

export interface NotificationsPersistencePort {
  findPropiedadWithCliente(propiedadId: string): Promise<{
    id: string;
    identificador: string;
    monto_a_la_fecha: number;
    cliente: { id: string; nombre: string; telefono: string | null };
  } | null>;

  createEventWithSequence(input: {
    propiedad_id: string;
    due_date: string;
    stage: NotificationStage;
    channel: NotificationChannel;
    idempotency_key: string;
    scheduled_for: Date;
  }): Promise<NotificationEvent>;
  findEventByIdempotencyKey(idempotencyKey: string): Promise<NotificationEvent | null>;
  findEventById(eventId: string): Promise<NotificationEvent | null>;

  listEventsByPropiedad(input: {
    propiedad_id: string;
    channel: NotificationChannel;
    limit: number;
    sort: "created_at" | "scheduled_for";
    order: "asc" | "desc";
  }): Promise<NotificationEvent[]>;

  listEligiblePropiedadesForDate(targetDateYmd: string): Promise<
    Array<{
      id: string;
      identificador: string;
      monto_a_la_fecha: number;
      cliente: { id: string; nombre: string; telefono: string | null };
      due_date: string;
    }>
  >;

  createScheduleEventIfNotExists(input: {
    propiedad_id: string;
    due_date: string;
    stage: NotificationStage;
    scheduled_for: Date;
    idempotency_key: string;
  }): Promise<{ created: boolean; event: NotificationEvent | null }>;

  cancelFuturePendingEvents(propiedad_id: string, due_date: string): Promise<number>;

  getPendingEventsForWorker(limit: number): Promise<
    Array<{
      id: string;
      propiedad_id: string;
      stage: NotificationStage;
      due_date: string;
      cliente_id: string;
      cliente_nombre: string;
      telefono: string | null;
      propiedad_identificador: string;
      monto_pendiente: string;
    }>
  >;
  getEventPayloadForWorker(eventId: string): Promise<{
    id: string;
    propiedad_id: string;
    stage: NotificationStage;
    due_date: string;
    cliente_id: string;
    cliente_nombre: string;
    telefono: string | null;
    propiedad_identificador: string;
    monto_pendiente: string;
  } | null>;

  markEventProcessing(eventId: string): Promise<void>;
  markEventSent(input: { eventId: string; provider_message_id: string; sent_at: Date }): Promise<void>;
  markEventFailed(input: {
    eventId: string;
    error_code?: string | null;
    error_message?: string | null;
  }): Promise<void>;

  persistWebhookEvent(payload: WhatsAppWebhookPayload): Promise<{ isDuplicate: boolean }>;
  applyWebhookStatus(payload: WhatsAppWebhookPayload): Promise<void>;

  countEventsByStatusSince(status: NotificationStatus, since: Date): Promise<number>;
}
