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
  const safeUrl = escapeHtml(input.registration_url);

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

  // Botón compatible con clientes de correo + URL visible de respaldo.
  const html = `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.5;background:#f5f5f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:28px 24px;">
            <tr>
              <td>
                <p style="margin:0 0 12px;font-size:16px;">Has sido invitado a <strong>LegalTech</strong>.</p>
                <p style="margin:0 0 16px;font-size:15px;">Rol: <strong>${escapeHtml(input.role_label)}</strong></p>
                <p style="margin:0 0 20px;font-size:15px;">
                  Para crear tu contraseña y activar tu cuenta, haz clic en el siguiente botón:
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
                  <tr>
                    <td align="center" bgcolor="#1d4ed8" style="border-radius:8px;">
                      <a
                        href="${safeUrl}"
                        target="_blank"
                        rel="noopener noreferrer"
                        style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;"
                      >
                        Activar cuenta
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:13px;color:#555;">
                  Si el botón no funciona, copia y pega este enlace en tu navegador:
                </p>
                <p style="margin:0 0 16px;font-size:13px;word-break:break-all;">
                  <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;">
                    ${safeUrl}
                  </a>
                </p>
                <p style="margin:0 0 12px;font-size:13px;color:#555;">
                  Este enlace expira el <strong>${escapeHtml(expiresLabel)}</strong> y solo puede usarse una vez.
                </p>
                <p style="margin:0;font-size:13px;color:#777;">
                  Si no esperabas esta invitación, ignora este correo.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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
