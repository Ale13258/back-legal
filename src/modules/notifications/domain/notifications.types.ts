export type NotificationChannel = "whatsapp";
export type NotificationStage = "d_minus_3" | "d_day_0" | "d_plus_3";
export type NotificationStatus =
  | "queued"
  | "processing"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "cancelled";

export type NotificationEvent = {
  id: string;
  sequence_id: string;
  propiedad_id: string;
  stage: NotificationStage;
  channel: NotificationChannel;
  status: NotificationStatus;
  scheduled_for: Date;
  sent_at: Date | null;
  delivered_at: Date | null;
  read_at: Date | null;
  provider_message_id: string | null;
  error_code: string | null;
  error_message: string | null;
  idempotency_key: string;
  created_at: Date;
  updated_at: Date;
};

export type RunSchedulesResult = {
  processed_properties: number;
  queued_events: number;
  skipped_paid_off: number;
  cancelled_future_events: number;
};

export type WhatsAppWebhookPayload = {
  provider_message_id: string;
  event_type: "delivered" | "read" | "failed";
  event_time: string;
  error_code?: string | null;
  error_message?: string | null;
};
