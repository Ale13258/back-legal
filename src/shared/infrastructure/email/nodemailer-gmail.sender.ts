import { ApiError } from "../../http/error-handler.js";
import { getGmailTransporter } from "./gmail-transport.js";
import type { EmailSenderPort, SendEmailInput, SendEmailResult } from "./email-sender.port.js";

export class NodemailerGmailEmailSender implements EmailSenderPort {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    try {
      const transporter = getGmailTransporter();
      const info = await transporter.sendMail({
        from: input.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: input.attachments?.map((file) => ({
          filename: file.filename,
          content: file.content,
          ...(file.cid ? { cid: file.cid } : {}),
          contentType: file.contentType,
          contentDisposition: file.contentDisposition ?? (file.cid ? "inline" : "attachment"),
        })),
      });

      const provider_id = info.messageId?.trim();
      if (!provider_id) {
        throw new Error("El proveedor no devolvió messageId");
      }

      return { provider_id };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Error al enviar correo";
      throw new ApiError(502, "EMAIL_SEND_FAILED", message);
    }
  }
}
