import {
  badgeAlerta,
  buildAlertaHtml,
  ellipsize,
  escapeHtml,
  formatDmy,
  resumenAlertas,
  sortPorTipoYVencimiento,
  tablaAlertas,
  withFiltroVencidas,
  type AlertaLink,
  type TipoAlertaTermino,
} from "../../../../shared/infrastructure/email/alerta-terminos.layout.js";

export type PqrAlertaItem = {
  tipo: TipoAlertaTermino;
  gestion: string | null;
  solicitante: string;
  entidad: string;
  asunto: string;
  radicado: string | null;
  vencimiento: string;
  estado: string | null;
};

export type PqrAlertaEmailInput = {
  hoy: string;
  items: PqrAlertaItem[];
  logo_cid: string;
  pqrs_links: AlertaLink[];
};

const MAX_FILAS = 15;

function fila(item: PqrAlertaItem, zebra: boolean): string {
  const bg = zebra ? "#faf8fb" : "#ffffff";
  const radicado = escapeHtml(item.radicado?.trim() || "Sin radicado");
  const partes = escapeHtml(ellipsize(`${item.solicitante} ante ${item.entidad}`, 48));
  const asunto = escapeHtml(ellipsize(item.asunto, 60));
  const gestion = item.gestion?.trim()
    ? escapeHtml(item.gestion.trim())
    : `<span style="color:#aaaaaa;">—</span>`;
  return `<tr>
    <td style="padding:10px 8px 10px 12px;border-bottom:1px solid #ece6f0;background:${bg};white-space:nowrap;">${badgeAlerta(item.tipo)}</td>
    <td style="padding:10px 8px;border-bottom:1px solid #ece6f0;background:${bg};font-size:13px;color:#1a1520;word-break:break-all;font-family:Arial,Helvetica,sans-serif;">${radicado}</td>
    <td style="padding:10px 8px;border-bottom:1px solid #ece6f0;background:${bg};font-size:13px;color:#444444;font-family:Arial,Helvetica,sans-serif;">${partes}</td>
    <td style="padding:10px 8px;border-bottom:1px solid #ece6f0;background:${bg};font-size:12px;line-height:1.45;color:#444444;font-family:Arial,Helvetica,sans-serif;">${asunto}</td>
    <td style="padding:10px 8px;border-bottom:1px solid #ece6f0;background:${bg};font-size:12px;color:#444444;white-space:nowrap;font-family:Arial,Helvetica,sans-serif;">${gestion}</td>
    <td style="padding:10px 12px 10px 8px;border-bottom:1px solid #ece6f0;background:${bg};font-size:13px;color:#1a1520;white-space:nowrap;text-align:right;font-family:Arial,Helvetica,sans-serif;">${formatDmy(item.vencimiento)}</td>
  </tr>`;
}

export function buildPqrAlertaEmail(input: PqrAlertaEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const ordered = sortPorTipoYVencimiento(input.items);
  const vencidas = ordered.filter((i) => i.tipo === "vencida").length;
  const porVencer = ordered.filter((i) => i.tipo === "por_vencer").length;
  const resumen = resumenAlertas(vencidas, porVencer);

  const subject = `Alerta interna de PQR (${resumen})`;
  const visible = ordered.slice(0, MAX_FILAS);
  const ocultas = ordered.length - visible.length;
  const links = input.pqrs_links.map((link) => ({
    label: link.label,
    url: withFiltroVencidas(link.url, vencidas > 0),
  }));

  const intro =
    vencidas > 0
      ? `Se identificaron <strong>${vencidas}</strong> petici${vencidas === 1 ? "ón" : "ones"} con término de respuesta vencido${
          porVencer ? ` y <strong>${porVencer}</strong> por vencer` : ""
        }. A continuación el listado para gestión interna; las vencidas van primero.`
      : `Se identificaron <strong>${porVencer}</strong> petici${porVencer === 1 ? "ón" : "ones"} con término de respuesta próximo a vencer. A continuación el listado para gestión interna.`;

  const html = buildAlertaHtml({
    subject,
    preheader: `Términos de PQR · ${resumen}`,
    seccion: "Radicados y PQR · uso interno",
    titulo: "Peticiones pendientes de respuesta",
    introHtml: intro,
    tablaHtml: tablaAlertas(
      [
        { titulo: "Estado" },
        { titulo: "Radicado" },
        { titulo: "Solicitante / entidad" },
        { titulo: "Asunto" },
        { titulo: "Responsable" },
        { titulo: "Vence", align: "right" },
      ],
      visible.map((item, i) => fila(item, i % 2 === 1)).join(""),
    ),
    ocultas,
    links,
    hoy: input.hoy,
    logo_cid: input.logo_cid,
  });

  const text = [
    "LEGALTECH — Radicados y PQR (uso interno)",
    `Alerta de términos · ${formatDmy(input.hoy)}`,
    "",
    intro.replaceAll(/<\/?strong>/g, ""),
    "",
    ...visible.map(
      (item) =>
        `- ${item.tipo === "vencida" ? "VENCIDA" : "POR VENCER"} · ${item.radicado || "Sin radicado"} · ${item.solicitante} ante ${item.entidad} · ${item.asunto} · vence ${formatDmy(item.vencimiento)}${item.gestion?.trim() ? ` · Responsable: ${item.gestion.trim()}` : ""}`,
    ),
    ocultas ? `Y ${ocultas} expedientes más en LegalTech.` : "",
    ...links.map((link) => `${link.label}: ${link.url}`),
    "",
    "Comunicación automática de uso interno. No se envía a clientes ni a contrapartes.",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
