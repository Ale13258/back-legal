import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../../../../shared/http/error-handler.js";
import { SendPaymentReminderEmailUseCase } from "../../application/use-cases/send-payment-reminder-email.use-case.js";
import { NodemailerGmailEmailSender } from "../email/nodemailer-gmail.sender.js";
import { PaymentRemindersPrismaRepository } from "../persistence/payment-reminders-prisma.repository.js";
import type { ReminderGestionRecord } from "../../domain/ports/payment-reminders-persistence.port.js";
import {
  parseEmailGestionDescripcion,
  gestionDescripcionPreview,
} from "../../domain/email-gestion-descripcion.js";
import {
  requireAuth,
  requireStaff,
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
  cuenta_id: z.string().uuid(),
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

function toEmailResponse(record: ReminderGestionRecord) {
  const email = parseEmailGestionDescripcion(record.descripcion);
  return {
    id: record.id,
    gestion_id: record.id,
    cuenta_id: record.cuenta_id,
    cliente_email: email?.cliente_email ?? "",
    extra_recipients: email?.extra_recipients ?? [],
    subject: email?.subject ?? gestionDescripcionPreview(record.descripcion),
    body_html: email?.body_html ?? null,
    body_text: email?.body_text ?? null,
    status: email?.status ?? record.estado,
    provider_id: email?.provider_id ?? null,
    error_message: null,
    sent_at: email?.sent_at ? new Date(email.sent_at) : record.fecha,
    created_at: record.created_at,
    descripcion: record.descripcion,
    resumen: gestionDescripcionPreview(record.descripcion),
  };
}

const persistence = new PaymentRemindersPrismaRepository();
const emailSender = new NodemailerGmailEmailSender();
const sendPaymentReminderEmailUseCase = new SendPaymentReminderEmailUseCase({
  persistence,
  emailSender,
});

export const paymentRemindersRouter = Router();

paymentRemindersRouter.post("/email/send", requireAuth, requireStaff(), async (req, res, next) => {
  try {
    const dto = sendSchema.parse(req.body);
    const attachments = parseAttachments(dto.attachments);
    const result = await sendPaymentReminderEmailUseCase.execute({
      cuenta_id: dto.cuenta_id,
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
  "/cuentas/:cuentaId/emails",
  requireAuth,
  requireStaff(),
  async (req, res, next) => {
    try {
      const q = listQuerySchema.parse(req.query);
      const items = await persistence.listEmailGestionesByCuenta(req.params.cuentaId, q.limit);
      res.json({ items: items.map(toEmailResponse) });
    } catch (error) {
      next(error);
    }
  },
);

const idParamSchema = z.object({
  id: z.string().uuid(),
});

/** Detalle de un correo = gestión tipo email_reminder (descripcion con el cuerpo). */
paymentRemindersRouter.get("/:id", requireAuth, requireStaff(), async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const record = await persistence.findEmailGestionById(id);
    if (!record) {
      throw new ApiError(404, "NOT_FOUND", "Recordatorio de correo no encontrado");
    }
    res.json(toEmailResponse(record));
  } catch (error) {
    next(error);
  }
});
