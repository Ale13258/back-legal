/**
 * Contenido de `Gestion.descripcion` cuando tipo = email_reminder.
 * Manuales usan texto plano en el mismo campo.
 */
export type EmailGestionDescripcion = {
  summary: string;
  subject: string;
  cliente_email: string;
  extra_recipients: string[];
  body_html: string;
  body_text: string;
  provider_id?: string | null;
  status?: string;
  sent_at?: string | null;
};

export function buildEmailGestionDescripcion(input: {
  subject: string;
  cliente_email: string;
  extra_recipients: string[];
  body_html: string;
  body_text: string;
  provider_id?: string | null;
  sent_at?: Date;
}): string {
  const payload: EmailGestionDescripcion = {
    summary: `Recordatorio de pago por correo — Asunto: ${input.subject} — Para: ${input.cliente_email}`,
    subject: input.subject,
    cliente_email: input.cliente_email,
    extra_recipients: input.extra_recipients,
    body_html: input.body_html,
    body_text: input.body_text,
    provider_id: input.provider_id ?? null,
    status: "sent",
    sent_at: input.sent_at?.toISOString() ?? null,
  };
  return JSON.stringify(payload);
}

export function parseEmailGestionDescripcion(
  raw: string,
): EmailGestionDescripcion | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as Partial<EmailGestionDescripcion>;
    if (typeof parsed.subject !== "string" || typeof parsed.body_html !== "string") {
      return null;
    }
    return {
      summary:
        typeof parsed.summary === "string"
          ? parsed.summary
          : `Recordatorio de pago — ${parsed.subject}`,
      subject: parsed.subject,
      cliente_email:
        typeof parsed.cliente_email === "string" ? parsed.cliente_email : "",
      extra_recipients: Array.isArray(parsed.extra_recipients)
        ? parsed.extra_recipients.filter((x): x is string => typeof x === "string")
        : [],
      body_html: parsed.body_html,
      body_text: typeof parsed.body_text === "string" ? parsed.body_text : "",
      provider_id: parsed.provider_id ?? null,
      status: typeof parsed.status === "string" ? parsed.status : "sent",
      sent_at: parsed.sent_at ?? null,
    };
  } catch {
    return null;
  }
}

/** Texto corto para timeline (summary o el string plano). */
export function gestionDescripcionPreview(descripcion: string): string {
  const email = parseEmailGestionDescripcion(descripcion);
  return email?.summary ?? descripcion;
}
