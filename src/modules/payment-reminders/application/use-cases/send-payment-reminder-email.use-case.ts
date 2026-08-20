import { ApiError } from "../../../../shared/http/error-handler.js";
import { getGmailFromAddress } from "../../../../shared/infrastructure/email/gmail-transport.js";
import { buildEmailGestionDescripcion } from "../../domain/email-gestion-descripcion.js";
import {
  mergeRecipientList,
  normalizeReminderRecipients,
} from "../../domain/normalize-recipients.js";
import { assertSafeReminderEmailBody } from "../../domain/validate-email-body.js";
import type { EmailSenderPort, SendEmailAttachment } from "../../domain/ports/email-sender.port.js";
import type { PaymentRemindersPersistencePort } from "../../domain/ports/payment-reminders-persistence.port.js";
import { embedReminderBrandingInHtml } from "../../infrastructure/email/embed-reminder-email-assets.js";
import { getPaymentReminderEmailAttachments } from "../../infrastructure/email/payment-reminder-email-assets.js";

export class SendPaymentReminderEmailUseCase {
  constructor(
    private readonly deps: {
      persistence: PaymentRemindersPersistencePort;
      emailSender: EmailSenderPort;
    },
  ) {}

  async execute(input: {
    cuenta_id: string;
    subject?: string;
    extra_recipients?: string[];
    body_html: string;
    body_text: string;
    attachments?: {
      filename: string;
      content: Buffer;
      contentType?: string;
    }[];
  }) {
    assertSafeReminderEmailBody(input.body_html);

    const cuenta = await this.deps.persistence.findCuentaForReminder(input.cuenta_id);
    if (!cuenta) {
      throw new ApiError(404, "NOT_FOUND", "Cuenta no encontrada");
    }

    if (cuenta.monto_a_la_fecha <= 0) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "La cuenta no tiene saldo pendiente para recordatorio",
      );
    }

    const to = (cuenta.cobro_email ?? "").trim();
    if (!to) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "La cuenta no tiene un email de cobro válido",
      );
    }

    const subject =
      input.subject?.trim() || `Recordatorio de pago - ${cuenta.identificador}`;
    const recipients = normalizeReminderRecipients(to, input.extra_recipients);
    const smtpTo = mergeRecipientList(recipients.cliente_email, recipients.extra_recipients);
    const html = embedReminderBrandingInHtml(input.body_html);

    const brandedAttachments: SendEmailAttachment[] = getPaymentReminderEmailAttachments().map(
      (file) => ({
        filename: file.filename,
        content: file.content,
        cid: file.cid,
        contentDisposition: "inline" as const,
      }),
    );

    const userAttachments: SendEmailAttachment[] =
      input.attachments?.map((file) => ({
        filename: file.filename,
        content: file.content,
        contentType: file.contentType,
        contentDisposition: "attachment" as const,
      })) ?? [];

    const sent = await this.deps.emailSender.send({
      from: getGmailFromAddress(),
      to: smtpTo,
      subject,
      html,
      text: input.body_text,
      attachments: [...brandedAttachments, ...userAttachments],
    });

    const sentAt = new Date();
    return this.deps.persistence.createSentEmailGestion({
      cuenta_id: cuenta.id,
      sent_at: sentAt,
      descripcion: buildEmailGestionDescripcion({
        subject,
        cliente_email: recipients.cliente_email,
        extra_recipients: recipients.extra_recipients,
        body_html: html,
        body_text: input.body_text,
        provider_id: sent.provider_id,
        sent_at: sentAt,
      }),
    });
  }
}
