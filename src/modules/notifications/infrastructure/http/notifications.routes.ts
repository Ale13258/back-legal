import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../../../../shared/http/error-handler.js";
import { requireAuth, requireRole } from "../../../../shared/security/auth.middleware.js";
import {
  requireInternalToken,
  verifyWebhookToken,
} from "../../../../shared/security/internal-token.middleware.js";
import { HandleWhatsAppWebhookUseCase } from "../../application/use-cases/handle-whatsapp-webhook.use-case.js";
import { ListNotificationEventsUseCase } from "../../application/use-cases/list-notification-events.use-case.js";
import { RunSchedulesUseCase } from "../../application/use-cases/run-schedules.use-case.js";
import { SendNotificationUseCase } from "../../application/use-cases/send-notification.use-case.js";
import { NotificationsPrismaRepository } from "../persistence/notifications-prisma.repository.js";
import { enqueueNotificationJob } from "../queue/notifications.queue.js";

const sendSchema = z.object({
  channel: z.literal("whatsapp"),
  propiedad_id: z.string().uuid(),
  stage: z.enum(["d_minus_3", "d_day_0", "d_plus_3"]),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  idempotency_key: z.string().min(1).optional(),
});

const listQuerySchema = z.object({
  channel: z.literal("whatsapp").default("whatsapp"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["created_at", "scheduled_for"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

const webhookSchema = z.object({
  provider_message_id: z.string().min(1),
  event_type: z.enum(["delivered", "read", "failed"]),
  event_time: z.string().datetime(),
  error_code: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
});
const requeueParamsSchema = z.object({
  eventId: z.string().uuid(),
});

const notificationsPersistence = new NotificationsPrismaRepository();
const sendNotificationUseCase = new SendNotificationUseCase({ notificationsPersistence });
const listNotificationEventsUseCase = new ListNotificationEventsUseCase({ notificationsPersistence });
const runSchedulesUseCase = new RunSchedulesUseCase({
  notificationsPersistence,
  queuePublisher: { enqueueNotificationJob },
});
const handleWhatsAppWebhookUseCase = new HandleWhatsAppWebhookUseCase({ notificationsPersistence });

export const notificationsRouter = Router();

notificationsRouter.post("/send", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const dto = sendSchema.parse(req.body);
    const event = await sendNotificationUseCase.execute(dto);
    const enqueued = await enqueueNotificationJob({ event_id: event.id });
    if (!enqueued) {
      console.warn("notifications_queue_unavailable", {
        request_id: req.requestId,
        event_id: event.id,
      });
    }
    res.status(202).json(event);
  } catch (error) {
    next(error);
  }
});

notificationsRouter.get("/propiedades/:propiedadId/events", requireAuth, async (req, res, next) => {
  try {
    const q = listQuerySchema.parse(req.query);
    const result = await listNotificationEventsUseCase.execute({
      propiedad_id: req.params.propiedadId,
      channel: q.channel,
      limit: q.limit,
      sort: q.sort,
      order: q.order,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post("/schedules/run", requireInternalToken, async (_req, res, next) => {
  try {
    const result = await runSchedulesUseCase.execute({});
    res.json(result);
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post(
  "/requeue/:eventId",
  requireAuth,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { eventId } = requeueParamsSchema.parse(req.params);
      const event = await notificationsPersistence.findEventById(eventId);
      if (!event) {
        throw new ApiError(404, "NOT_FOUND", "Evento no encontrado");
      }
      if (["sent", "delivered", "read", "cancelled"].includes(event.status)) {
        throw new ApiError(409, "CONFLICT", "El evento no es reencolable");
      }

      const enqueued = await enqueueNotificationJob({ event_id: event.id });
      if (!enqueued) {
        throw new ApiError(503, "QUEUE_UNAVAILABLE", "Redis/cola no disponible");
      }

      res.status(202).json({ ok: true, event_id: event.id, status: event.status });
    } catch (error) {
      next(error);
    }
  },
);

notificationsRouter.post("/webhooks/whatsapp", verifyWebhookToken, async (req, res, next) => {
  try {
    const dto = webhookSchema.parse(req.body);
    await handleWhatsAppWebhookUseCase.execute(dto);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
