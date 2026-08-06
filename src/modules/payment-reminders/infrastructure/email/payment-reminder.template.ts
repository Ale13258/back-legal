import {
  PAYMENT_REMINDER_ICON_EMAIL_CID,
  PAYMENT_REMINDER_ICON_INSTAGRAM_CID,
  PAYMENT_REMINDER_ICON_PHONE_CID,
  PAYMENT_REMINDER_LOGO_CID,
} from "./payment-reminder-email-assets.js";

export type PaymentReminderTemplateInput = {
  clienteNombre: string;
  cuentaIdentificador: string;
  cuentaDireccion: string | null;
  montoPendiente: number;
  fechaCorte: string;
  /** Texto opcional que el administrador agrega al recordatorio. */
  nota?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function formatCurrencyCop(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatFechaCorteEsCo(timeZone = process.env.BUSINESS_TIMEZONE ?? "America/Bogota"): string {
  return new Date().toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  });
}

function buildNotaPlainBlock(nota: string | undefined): string[] {
  const trimmed = nota?.trim();
  if (!trimmed) return [];
  return ["", "Nota:", trimmed];
}

function buildNotaHtmlBlock(nota: string | undefined): string {
  const trimmed = nota?.trim();
  if (!trimmed) return "";
  const body = escapeHtml(trimmed).replaceAll("\n", "<br>");
  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 20px;">
                <tr>
                  <td style="padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;">
                    <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;font-weight:600;color:#92400e;font-family:Arial,Helvetica,sans-serif;">Nota</p>
                    <p style="margin:0;font-size:14px;line-height:1.55;color:#78350f;font-family:Arial,Helvetica,sans-serif;">${body}</p>
                  </td>
                </tr>
              </table>`;
}

function buildEmailHeaderHtml(fecha: string): string {
  const logoSrc = `cid:${PAYMENT_REMINDER_LOGO_CID}`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr>
        <td style="background:#611374;padding:24px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td valign="middle" width="58" style="padding-right:14px;">
                <img src="${logoSrc}" alt="LegalTech" width="48" height="48" style="display:block;width:48px;height:48px;border:0;border-radius:10px;" />
              </td>
              <td valign="middle">
                <p style="margin:0;font-size:20px;line-height:1.2;font-weight:700;color:#ffffff;font-family:Segoe UI,Helvetica,Arial,sans-serif;">LegalTech</p>
                <p style="margin:5px 0 0;font-size:12px;line-height:1.4;color:rgba(255,255,255,0.9);font-family:Segoe UI,Helvetica,Arial,sans-serif;">Departamento de Cartera</p>
              </td>
              <td valign="middle" align="right">
                <p style="margin:0;font-size:13px;line-height:1.4;color:rgba(255,255,255,0.95);font-family:Segoe UI,Helvetica,Arial,sans-serif;">${fecha}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

const COMPANY = {
  name: "LEGALTECH",
  tagline: "ABOGADOS DIGITALES",
  website: "https://abogadosdigitales.com.co/",
  websiteLabel: "abogadosdigitales.com.co",
  phone: { display: "+573027636712", tel: "+573027636712" },
  emails: [
    "analistalegal@abogadosdigitales.com.co",
    "abogadojunior@abogadosdigitales.com.co",
  ],
  instagram:
    "https://www.instagram.com/legaltechabogadosdigitales?igsh=MTFjOWVnbGsxYm85aw%3D%3D",
};

const TEXTO_INQUIETUDES = `Cualquier inquietud al respecto será atendida en el teléfono ${COMPANY.phone.display} y los correos: ${COMPANY.emails[0]} y ${COMPANY.emails[1]}.`;

/** Borde vertical visible en Gmail/Outlook (evita celdas de 1px con rgba). */
const FOOTER_COL_BORDER = "border-left:1px solid #b884ca;";

function buildCompanyFooterHtml(): string {
  const year = new Date().getFullYear();
  const logoSrc = `cid:${PAYMENT_REMINDER_LOGO_CID}`;
  const phoneLink = `<a href="tel:${COMPANY.phone.tel}" style="color:#ffffff;text-decoration:none;">${escapeHtml(COMPANY.phone.display)}</a>`;
  const emailRows = COMPANY.emails
    .map(
      (email) => `
                  <tr>
                    <td valign="top" style="padding:2px 8px 0 0;">
                      <img src="cid:${PAYMENT_REMINDER_ICON_EMAIL_CID}" alt="" width="18" height="18" style="display:block;border:0;" />
                    </td>
                    <td style="padding:0 0 4px;font-size:12px;line-height:1.45;font-style:italic;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
                      <a href="mailto:${email}" style="color:#ffffff;text-decoration:none;">${escapeHtml(email)}</a>
                    </td>
                  </tr>`,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr>
        <td style="background:#611374;padding:18px 12px 10px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td width="78" valign="middle" align="center" style="padding:8px 12px;">
                <a href="${COMPANY.website}" style="text-decoration:none;">
                  <img src="${logoSrc}" alt="LegalTech" width="56" height="56" style="display:block;width:56px;height:56px;border:0;" />
                </a>
              </td>
              <td valign="middle" style="padding:8px 16px;min-width:120px;${FOOTER_COL_BORDER}">
                <a href="${COMPANY.website}" style="text-decoration:none;color:#ffffff;">
                  <p style="margin:0;font-size:15px;line-height:1.15;font-weight:700;letter-spacing:0.04em;color:#ffffff;font-family:Segoe UI,Helvetica,Arial,sans-serif;">${COMPANY.name}</p>
                  <p style="margin:3px 0 0;font-size:10px;line-height:1.3;letter-spacing:0.1em;color:#ffffff;font-family:Segoe UI,Helvetica,Arial,sans-serif;">${COMPANY.tagline}</p>
                </a>
                <p style="margin:6px 0 0;font-size:11px;line-height:1.3;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
                  <a href="${COMPANY.website}" style="color:#eeacff;text-decoration:underline;">${COMPANY.websiteLabel}</a>
                </p>
              </td>
              <td valign="middle" style="padding:8px 16px;${FOOTER_COL_BORDER}">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td valign="top" style="padding:0 8px 6px 0;">
                      <img src="cid:${PAYMENT_REMINDER_ICON_PHONE_CID}" alt="" width="18" height="18" style="display:block;border:0;" />
                    </td>
                    <td style="font-size:12px;line-height:1.45;font-style:italic;color:#ffffff;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
                      ${phoneLink}
                    </td>
                  </tr>
                  ${emailRows}
                </table>
              </td>
              <td width="92" valign="middle" align="center" style="padding:8px 12px;${FOOTER_COL_BORDER}">
                <p style="margin:0 0 8px;font-size:11px;line-height:1.2;font-weight:700;letter-spacing:0.06em;color:#ffffff;font-family:Segoe UI,Helvetica,Arial,sans-serif;">SÍGUENOS</p>
                <a href="${COMPANY.instagram}" style="text-decoration:none;">
                  <img src="cid:${PAYMENT_REMINDER_ICON_INSTAGRAM_CID}" alt="Instagram LegalTech" width="28" height="28" style="display:block;border:0;margin:0 auto;" />
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="background:#611374;padding:0 16px 14px;">
          <p style="margin:0;font-size:10px;line-height:1.4;color:rgba(255,255,255,0.9);font-family:Segoe UI,Helvetica,Arial,sans-serif;">
            © ${year} LegalTech | Todos los derechos reservados.
          </p>
        </td>
      </tr>
    </table>`;
}

function buildCompanyFooterPlainLines(): string[] {
  const year = new Date().getFullYear();
  return [
    "",
    "—",
    `${COMPANY.name} | ${COMPANY.tagline}`,
    COMPANY.website,
    `Tel: ${COMPANY.phone.display}`,
    `Correos: ${COMPANY.emails.join(" - ")}`,
    `Instagram: ${COMPANY.instagram}`,
    `© ${year} LegalTech | Todos los derechos reservados.`,
  ];
}

export function buildPaymentReminderPlainText(input: PaymentReminderTemplateInput): string {
  const direccion = input.cuentaDireccion?.trim() || "—";
  const monto = formatCurrencyCop(input.montoPendiente);

  return [
    "LEGALTECH — Departamento de Cartera",
    "Recordatorio de pago",
    `Fecha de corte: ${input.fechaCorte}`,
    "",
    `Estimado(a) ${input.clienteNombre},`,
    "",
    `Por medio de la presente nos permitimos recordarle que a la fecha presenta un saldo pendiente de pago correspondiente a la cuenta ${input.cuentaIdentificador} ubicada en ${direccion}.`,
    "",
    `Monto pendiente: ${monto}`,
    `Fecha de corte: ${input.fechaCorte}`,
    ...buildNotaPlainBlock(input.nota),
    "",
    "Le solicitamos amablemente realizar el pago a la mayor brevedad posible para evitar la generación de intereses de mora y/o el inicio de acciones de cobro adicionales.",
    "",
    "Si ya realizó el pago, por favor haga caso omiso de esta comunicación y envíenos el soporte respectivo.",
    TEXTO_INQUIETUDES,
    "",
    "Cordialmente,",
    "Departamento de Cartera — LegalTech",
    ...buildCompanyFooterPlainLines(),
  ].join("\n");
}

function buildInquietudesHtmlBlock(): string {
  const phone = `<a href="tel:${COMPANY.phone.tel}" style="color:#611374;text-decoration:underline;">${escapeHtml(COMPANY.phone.display)}</a>`;
  const emailLinks = COMPANY.emails
    .map(
      (email) =>
        `<a href="mailto:${email}" style="color:#611374;text-decoration:underline;">${escapeHtml(email)}</a>`,
    )
    .join(" y ");
  return `<p style="margin:0 0 20px;font-size:14px;color:#666666;">Cualquier inquietud al respecto será atendida en el teléfono ${phone} y los correos: ${emailLinks}.</p>`;
}

export function buildPaymentReminderEmailHtml(input: PaymentReminderTemplateInput): string {
  const cliente = escapeHtml(input.clienteNombre);
  const identificador = escapeHtml(input.cuentaIdentificador);
  const direccion = escapeHtml(input.cuentaDireccion?.trim() || "—");
  const monto = escapeHtml(formatCurrencyCop(input.montoPendiente));
  const fecha = escapeHtml(input.fechaCorte);
  const header = buildEmailHeaderHtml(fecha);
  const footer = buildCompanyFooterHtml();
  const notaBlock = buildNotaHtmlBlock(input.nota);

  const preheader = escapeHtml(
    `Recordatorio de pago — ${input.cuentaIdentificador} — ${formatCurrencyCop(input.montoPendiente)}`,
  );

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Recordatorio de pago - ${identificador}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#ececec;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ececec" style="background-color:#ececec;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:16px 8px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;border-collapse:collapse;border:1px solid #dddddd;">
          <tr><td>${header}</td></tr>
          <tr>
            <td style="padding:24px 28px 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#333333;">
              <p style="margin:0 0 14px;font-size:15px;color:#333333;">Estimado(a) <strong>${cliente}</strong>,</p>
              <p style="margin:0 0 18px;font-size:15px;color:#444444;">Por medio de la presente nos permitimos recordarle que a la fecha presenta un <strong>saldo pendiente de pago</strong> correspondiente a la cuenta indicada a continuación.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 18px;">
                <tr>
                  <td style="padding:12px 14px;background-color:#f7f7f7;border:1px solid #e0e0e0;">
                    <p style="margin:0 0 4px;font-size:14px;color:#222222;"><strong>Cuenta:</strong> ${identificador}</p>
                    <p style="margin:0;font-size:14px;color:#555555;"><strong>Dirección:</strong> ${direccion}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 20px;">
                <tr>
                  <td style="padding:16px 18px;background-color:rgba(238,172,255,0.18);border:1px solid rgba(97,19,116,0.2);border-left:4px solid #611374;">
                    <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;color:#611374;">Monto pendiente</p>
                    <p style="margin:0 0 6px;font-size:24px;line-height:1.2;font-weight:700;color:#611374;">${monto}</p>
                    <p style="margin:0;font-size:13px;color:#555555;">Fecha de corte: <strong style="color:#333333;">${fecha}</strong></p>
                  </td>
                </tr>
              </table>
              ${notaBlock}
              <p style="margin:0 0 14px;font-size:15px;color:#444444;">Le solicitamos amablemente realizar el pago a la mayor brevedad posible para evitar la generación de intereses de mora y/o el inicio de acciones de cobro adicionales.</p>
              <p style="margin:0 0 14px;font-size:14px;color:#666666;">Si ya realizó el pago, por favor haga caso omiso de esta comunicación y envíenos el soporte respectivo.</p>
              ${buildInquietudesHtmlBlock()}
              <p style="margin:0;font-size:15px;color:#333333;">Cordialmente,<br><strong>Departamento de Cartera</strong><br>LegalTech</p>
            </td>
          </tr>
          <tr><td>${footer}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
