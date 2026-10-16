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
} from "../../../../shared/infrastructure/email/alerta-terminos.layout.js";
import type { TipoAlertaTutela } from "../../domain/alerta-tutela.js";

export { withFiltroVencidas };

export type TutelaAlertaItem = {
  tipo: TipoAlertaTutela;
  radicado: string | null;
  juzgado: string | null;
  accionante: string;
  accionado: string;
  derecho: string;
  etapa_label: string;
  vencimiento: string;
  cliente_nombre: string | null;
  nota: string | null;
};

export type TutelaAlertaLink = AlertaLink;

export type TutelaAlertaEmailInput = {
  hoy: string;
  items: TutelaAlertaItem[];
  logo_cid: string;
  tutelas_links: TutelaAlertaLink[];
};

const MAX_FILAS = 15;

function fila(item: TutelaAlertaItem, zebra: boolean): string {
  const bg = zebra ? "#faf8fb" : "#ffffff";
  const radicado = escapeHtml(item.radicado?.trim() || "Sin radicado");
  const partes = escapeHtml(
    ellipsize(`${item.accionante} c/ ${item.accionado}`, 42),
  );
  const nota = item.nota?.trim()
    ? escapeHtml(item.nota.trim()).replaceAll("\n", "<br />")
    : `<span style="color:#aaaaaa;">—</span>`;
  return `<tr>
    <td style="padding:10px 8px 10px 12px;border-bottom:1px solid #ece6f0;background:${bg};white-space:nowrap;">${badgeAlerta(item.tipo)}</td>
    <td style="padding:10px 8px;border-bottom:1px solid #ece6f0;background:${bg};font-size:13px;color:#1a1520;font-family:Arial,Helvetica,sans-serif;">${radicado}</td>
    <td style="padding:10px 8px;border-bottom:1px solid #ece6f0;background:${bg};font-size:13px;color:#444444;font-family:Arial,Helvetica,sans-serif;">${partes}</td>
    <td style="padding:10px 8px;border-bottom:1px solid #ece6f0;background:${bg};font-size:12px;line-height:1.45;color:#444444;word-break:break-word;font-family:Arial,Helvetica,sans-serif;">${nota}</td>
    <td style="padding:10px 12px 10px 8px;border-bottom:1px solid #ece6f0;background:${bg};font-size:13px;color:#1a1520;white-space:nowrap;text-align:right;font-family:Arial,Helvetica,sans-serif;">${formatDmy(item.vencimiento)}</td>
  </tr>`;
}

export function buildTutelaAlertaEmail(input: TutelaAlertaEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const ordered = sortPorTipoYVencimiento(input.items);
  const vencidas = ordered.filter((i) => i.tipo === "vencida").length;
  const porVencer = ordered.filter((i) => i.tipo === "por_vencer").length;
  const resumen = resumenAlertas(vencidas, porVencer);

  const subject = `Alerta interna de tutelas (${resumen})`;
  const visible = ordered.slice(0, MAX_FILAS);
  const ocultas = ordered.length - visible.length;
  const links = input.tutelas_links.map((link) => ({
    label: link.label,
    url: withFiltroVencidas(link.url, vencidas > 0),
  }));

  const intro =
    vencidas > 0
      ? `Se identificaron <strong>${vencidas}</strong> tutela${vencidas === 1 ? "" : "s"} con término vencido${
          porVencer ? ` y <strong>${porVencer}</strong> por vencer` : ""
        }. A continuación el listado para gestión interna; las vencidas van primero.`
      : `Se identificaron <strong>${porVencer}</strong> tutela${porVencer === 1 ? "" : "s"} con término próximo a vencer. A continuación el listado para gestión interna.`;

  const html = buildAlertaHtml({
    subject,
    preheader: `Términos de tutela · ${resumen}`,
    seccion: "Acciones de tutela · uso interno",
    titulo: "Términos de tutela pendientes de revisión",
    introHtml: intro,
    tablaHtml: tablaAlertas(
      [
        { titulo: "Estado" },
        { titulo: "Radicado" },
        { titulo: "Partes" },
        { titulo: "Nota" },
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
    "LEGALTECH — Acciones de tutela (uso interno)",
    `Alerta de términos · ${formatDmy(input.hoy)}`,
    "",
    intro.replaceAll(/<\/?strong>/g, ""),
    "",
    ...visible.map(
      (item) =>
        `- ${item.tipo === "vencida" ? "VENCIDA" : "POR VENCER"} · ${item.radicado || "Sin radicado"} · ${item.accionante} c/ ${item.accionado} · vence ${formatDmy(item.vencimiento)}${item.nota?.trim() ? ` · Nota: ${item.nota.trim()}` : ""}`,
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
