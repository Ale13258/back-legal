export type SendEmailAttachment = {
  filename: string;
  content: Buffer;
  /** Si se define, la imagen se embebe en el HTML (CID). */
  cid?: string;
  contentType?: string;
  contentDisposition?: "inline" | "attachment";
};

export type SendEmailInput = {
  /** Header From completo, p. ej. `"Nombre" <correo@dominio>`. */
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: SendEmailAttachment[];
};

export type SendEmailResult = {
  provider_id: string;
};

export interface EmailSenderPort {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
