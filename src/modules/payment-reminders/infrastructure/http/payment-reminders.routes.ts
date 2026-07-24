import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../../../../shared/http/error-handler.js";
import { SendPaymentReminderEmailUseCase } from "../../application/use-cases/send-payment-reminder-email.use-case.js";
import { NodemailerGmailEmailSender } from "../email/nodemailer-gmail.sender.js";
import { PaymentRemindersPrismaRepository } from "../persistence/payment-reminders-prisma.repository.js";
import type { PaymentReminderEmailWithBody } from "../../domain/ports/payment-reminders-persistence.port.js";
import {
  requireAuth,
  requireRole,
} from "../../../../shared/security/auth.middleware.js";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;
const MAX_TOTAL_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const attachmentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  content_base64: z.string().trim().min(1),
  mime_type: z.string().trim().max(127).optional(),
});

const sendSchema = z.object({
  propiedad_id: z.string().uuid(),
  subject: z.string().trim().min(1).max(200).optional(),
  extra_recipients: z.array(z.string().trim().email()).max(5).optional(),
  body_html: z
    .string()
    .trim()
    .min(1, "El cuerpo del correo no puede estar vacío")
    .max(200 * 1024),
  body_text: z
    .string()
    .trim()
    .min(1, "El cuerpo del correo no puede estar vacío")
    .max(50 * 1024),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional(),
});

function parseAttachments(
  raw: z.infer<typeof attachmentSchema>[] | undefined,
): { filename: string; content: Buffer; contentType?: string }[] {
  if (!raw?.length) return [];

  let totalBytes = 0;
  const parsed: { filename: string; content: Buffer; contentType?: string }[] = [];

  for (const item of raw) {
    let content: Buffer;
    try {
      content = Buffer.from(item.content_base64, "base64");
    } catch {
      throw new ApiError(400, "VALIDATION_ERROR", "Adjunto con contenido base64 inválido");
    }
    if (content.length === 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "Adjunto vacío");
    }
    if (content.length > MAX_ATTACHMENT_BYTES) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        `El adjunto "${item.filename}" supera el límite de 5 MB`,
      );
    }
    totalBytes += content.length;
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw new ApiError(400, "VALIDATION_ERROR", "El tamaño total de adjuntos supera 15 MB");
    }
    parsed.push({
      filename: item.filename,
      content,
      contentType: item.mime_type?.trim() || undefined,
    });
  }

  return parsed;
}

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

function toEmailResponse(record: PaymentReminderEmailWithBody) {
  return {
    id: record.id,
    propiedad_id: record.propiedad_id,
    cliente_email: record.cliente_email,
    extra_recipients: record.extra_recipients,
    subject: record.subject,
    body_html: record.body_html,
    body_text: record.body_text,
    status: record.status,
    provider_id: record.provider_id,
    error_message: record.error_message,
    sent_at: record.sent_at,
    created_at: record.created_at,
    gestion_id: record.gestion_id,
  };
}

const persistence = new PaymentRemindersPrismaRepository();
const emailSender = new NodemailerGmailEmailSender();
const sendPaymentReminderEmailUseCase = new SendPaymentReminderEmailUseCase({
  persistence,
  emailSender,
});

export const paymentRemindersRouter = Router();

paymentRemindersRouter.post("/email/send", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const dto = sendSchema.parse(req.body);
    const attachments = parseAttachments(dto.attachments);
    const result = await sendPaymentReminderEmailUseCase.execute({
      propiedad_id: dto.propiedad_id,
      subject: dto.subject,
      extra_recipients: dto.extra_recipients,
      body_html: dto.body_html,
      body_text: dto.body_text,
      attachments,
    });
    res.status(200).json(toEmailResponse(result));
  } catch (error) {
    next(error);
  }
});

paymentRemindersRouter.get(
  "/propiedades/:propiedadId/emails",
  requireAuth,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const q = listQuerySchema.parse(req.query);
      const items = await persistence.listByPropiedad(req.params.propiedadId, q.limit);
      res.json({ items: items.map(toEmailResponse) });
    } catch (error) {
      next(error);
    }
  },
);

const idParamSchema = z.object({
  id: z.string().uuid(),
});

/** Detalle de un correo (p.ej. desde gestión con email_reminder_id). */
paymentRemindersRouter.get("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const record = await persistence.findById(id);
    if (!record) {
      throw new ApiError(404, "NOT_FOUND", "Recordatorio de correo no encontrado");
    }
    res.json(toEmailResponse(record));
  } catch (error) {
    next(error);
  }
});
