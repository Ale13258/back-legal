export type StaffInvitationEmailInput = {
  to: string;
  registration_url: string;
  role_label: string;
  expires_at: Date;
};

export type StaffInvitationEmailContent = {
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

export function buildStaffInvitationEmail(
  input: StaffInvitationEmailInput,
): StaffInvitationEmailContent {
  const expiresLabel = formatExpiresAt(input.expires_at);
  const subject = "Invitación a LegalTech — activa tu cuenta";

  const text = [
    "Has sido invitado a LegalTech.",
    "",
    `Rol: ${input.role_label}`,
    "",
    "Para crear tu contraseña y activar tu cuenta, abre el siguiente enlace:",
    input.registration_url,
    "",
    `Este enlace expira el ${expiresLabel} y solo puede usarse una vez.`,
    "",
    "Si no esperabas esta invitación, ignora este correo.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="es">
  <body style="font-family: Arial, sans-serif; color: #1a1a1a; line-height: 1.5;">
    <p>Has sido invitado a <strong>LegalTech</strong>.</p>
    <p>Rol: <strong>${escapeHtml(input.role_label)}</strong></p>
    <p>
      Para crear tu contraseña y activar tu cuenta, haz clic en el siguiente botón:
    </p>
    <p>
      <a
        href="${escapeHtml(input.registration_url)}"
        style="display:inline-block;padding:10px 16px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:6px;"
      >
        Activar cuenta
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
