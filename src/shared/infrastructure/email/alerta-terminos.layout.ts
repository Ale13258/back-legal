export type TipoAlertaTermino = "por_vencer" | "vencida";

export type AlertaLink = {
  label: string;
  url: string;
};

export const ALERTA_BRAND = "#611374";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatDmy(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

export function ellipsize(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function withFiltroVencidas(url: string, hayVencidas: boolean): string {
  if (!hayVencidas) return url;
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}filtro=vencidas`;
}

function ctaButton(href: string, label: string, primary: boolean): string {
  const style = primary
    ? `display:inline-block;background:${ALERTA_BRAND};color:#ffffff;text-decoration:none;border-radius:4px;padding:12px 20px;font-size:13px;font-weight:700;letter-spacing:0.02em;font-family:Arial,Helvetica,sans-serif;`
    : `display:inline-block;background:#ffffff;color:${ALERTA_BRAND};text-decoration:none;border:1px solid ${ALERTA_BRAND};border-radius:4px;padding:11px 20px;font-size:13px;font-weight:700;letter-spacing:0.02em;font-family:Arial,Helvetica,sans-serif;`;
  return `<a href="${escapeHtml(href)}" style="${style}">${escapeHtml(label)}</a>`;
}

export function badgeAlerta(tipo: TipoAlertaTermino): string {
  if (tipo === "vencida") {
    return `<span style="display:inline-block;background:#fde8e8;color:#9b1c1c;border:1px solid #f5c2c2;border-radius:3px;padding:2px 7px;font-size:10px;font-weight:700;letter-spacing:0.04em;">VENCIDA</span>`;
  }
  return `<span style="display:inline-block;background:#fff7e6;color:#92400e;border:1px solid #f3d19e;border-radius:3px;padding:2px 7px;font-size:10px;font-weight:700;letter-spacing:0.04em;">POR VENCER</span>`;
}

export function sortPorTipoYVencimiento<T extends { tipo: TipoAlertaTermino; vencimiento: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === "vencida" ? -1 : 1;
    return a.vencimiento.localeCompare(b.vencimiento);
  });
}

export function resumenAlertas(vencidas: number, porVencer: number): string {
  return [
    vencidas ? `${vencidas} vencida${vencidas === 1 ? "" : "s"}` : null,
    porVencer ? `${porVencer} por vencer` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export type AlertaColumna = { titulo: string; align?: "left" | "right" };

export function tablaAlertas(columnas: AlertaColumna[], filasHtml: string): string {
  const ultima = columnas.length - 1;
  const ths = columnas
    .map((col, i) => {
      const padding = i === 0 ? "9px 8px 9px 12px" : i === ultima ? "9px 12px 9px 8px" : "9px 8px";
      return `<th align="${col.align ?? "left"}" style="padding:${padding};background:${ALERTA_BRAND};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">${col.titulo}</th>`;
    })
    .join("\n      ");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #e4dcea;margin:0 0 18px;">
    <tr>
      ${ths}
    </tr>
    ${filasHtml}
  </table>`;
}

export type AlertaLayoutInput = {
  subject: string;
  preheader: string;
  /** Subtítulo junto al logo, p. ej. "Acciones de tutela · uso interno". */
  seccion: string;
  titulo: string;
  introHtml: string;
  tablaHtml: string;
  /** Filas que no caben en el correo. */
  ocultas: number;
  links: AlertaLink[];
  hoy: string;
  logo_cid: string;
};

export function buildAlertaHtml(input: AlertaLayoutInput): string {
  const resto = input.ocultas
    ? `<p style="margin:0 0 16px;font-size:13px;color:#666666;font-family:Arial,Helvetica,sans-serif;">Y ${input.ocultas} expediente${input.ocultas === 1 ? "" : "s"} más en LegalTech.</p>`
    : "";

  const cta = input.links.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 4px;">${input.links
        .map(
          (link, i) =>
            `<tr><td style="padding:0 0 10px 0;">${ctaButton(link.url, link.label, i === 0)}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#ececec;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ececec" style="background-color:#ececec;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:16px 8px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:640px;background-color:#ffffff;border-collapse:collapse;border:1px solid #dddddd;">
          <tr>
            <td style="background:${ALERTA_BRAND};padding:24px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td valign="middle" width="58" style="padding-right:14px;">
                    <img src="cid:${input.logo_cid}" alt="LegalTech" width="48" height="48" style="display:block;width:48px;height:48px;border:0;border-radius:10px;" />
                  </td>
                  <td valign="middle">
                    <p style="margin:0;font-size:20px;line-height:1.2;font-weight:700;color:#ffffff;font-family:Segoe UI,Helvetica,Arial,sans-serif;">LegalTech</p>
                    <p style="margin:5px 0 0;font-size:12px;line-height:1.4;color:rgba(255,255,255,0.9);font-family:Segoe UI,Helvetica,Arial,sans-serif;">${escapeHtml(input.seccion)}</p>
                  </td>
                  <td valign="middle" align="right">
                    <p style="margin:0;font-size:13px;line-height:1.4;color:rgba(255,255,255,0.95);font-family:Segoe UI,Helvetica,Arial,sans-serif;">${formatDmy(input.hoy)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 12px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#333333;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${ALERTA_BRAND};">Alerta de términos</p>
              <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;font-weight:700;color:#1a1520;">${escapeHtml(input.titulo)}</h1>
              <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#444444;">${input.introHtml}</p>
              ${input.tablaHtml}
              ${resto}
              ${cta}
              <p style="margin:8px 0 0;font-size:12px;line-height:1.45;color:#888888;">Comunicación automática de uso interno. No se envía a clientes ni a contrapartes.</p>
            </td>
          </tr>
          <tr>
            <td style="background:${ALERTA_BRAND};padding:16px 28px;">
              <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.04em;color:#ffffff;font-family:Segoe UI,Helvetica,Arial,sans-serif;">LEGALTECH</p>
              <p style="margin:3px 0 0;font-size:10px;letter-spacing:0.1em;color:#ffffff;font-family:Segoe UI,Helvetica,Arial,sans-serif;">ABOGADOS DIGITALES</p>
              <p style="margin:8px 0 0;font-size:11px;color:rgba(255,255,255,0.9);font-family:Arial,Helvetica,sans-serif;">
                <a href="https://abogadosdigitales.com.co/" style="color:#eeacff;text-decoration:underline;">abogadosdigitales.com.co</a>
                &nbsp;·&nbsp;© ${year} LegalTech
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
