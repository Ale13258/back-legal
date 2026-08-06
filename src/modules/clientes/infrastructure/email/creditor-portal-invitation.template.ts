export type CreditorPortalInvitationEmailInput = {
  to: string;
  creditor_name: string;
  registration_url: string;
  expires_at: Date;
};

export type CreditorPortalInvitationEmailContent = {
  subject: string;
  html: string;
  text: string;
};

function formatExpiresAt(date: Date): string {
  return date.toLocaleString("es-CO", {
    timeZone: process.env.BUSINESS_TIMEZONE?.trim() || "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildCreditorPortalInvitationEmail(
  input: CreditorPortalInvitationEmailInput,
): CreditorPortalInvitationEmailContent {
  const expiresLabel = formatExpiresAt(input.expires_at);
  const subject = "Invitación a LegalTech — activa tu acceso a informes";

  const text = [
    `Hola, ${input.creditor_name}.`,
    "",
    "Te invitamos a activar tu acceso al portal de LegalTech para consultar tus informes y cartera.",
    "",
    "Para crear tu contraseña, abre el siguiente enlace:",
    input.registration_url,
    "",
    `Este enlace expira el ${expiresLabel} y solo puede usarse una vez.`,
    "",
    "Si no esperabas esta invitación, ignora este correo.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="es">
  <body style="font-family: Arial, sans-serif; color: #1a1a1a; line-height: 1.5;">
    <p>Hola, <strong>${escapeHtml(input.creditor_name)}</strong>.</p>
    <p>
      Te invitamos a activar tu acceso al portal de <strong>LegalTech</strong>
      para consultar tus informes y cartera.
    </p>
    <p>
      <a
        href="${escapeHtml(input.registration_url)}"
        style="display:inline-block;padding:10px 16px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:6px;"
      >
        Crear contraseña
      </a>
    </p>
    <p style="font-size:13px;color:#555;">
      Este enlace expira el <strong>${escapeHtml(expiresLabel)}</strong> y solo puede usarse una vez.
    </p>
    <p style="font-size:13px;color:#777;">
      Si no esperabas esta invitación, ignora este correo.
    </p>
  </body>
</html>`;

  return { subject, html, text };
}
