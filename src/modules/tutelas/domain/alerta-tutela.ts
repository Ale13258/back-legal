import { diasHabilesEntre } from "./dias-habiles-co.js";
import { ETAPAS_TUTELA_SIN_ALERTA, type EtapaTutela } from "./etapa-tutela.js";

export type TipoAlertaTutela = "por_vencer" | "vencida";

export const DIAS_HABILES_AVISO_TUTELA = 2;

export type EstadoAlertaTutela = {
  etapa: EtapaTutela;
  vencimiento: string | null;
  alerta_por_vencer_enviada_at: Date | null;
  alerta_vencida_enviada_at: Date | null;
};

/** Qué alerta corresponde hoy (cada tipo se envía una sola vez por vencimiento). */
export function clasificarAlertaTutela(
  tutela: EstadoAlertaTutela,
  hoyYmd: string,
): TipoAlertaTutela | null {
  if (!tutela.vencimiento) return null;
  if (ETAPAS_TUTELA_SIN_ALERTA.includes(tutela.etapa)) return null;

  if (tutela.vencimiento < hoyYmd) {
    return tutela.alerta_vencida_enviada_at ? null : "vencida";
  }

  const restantes = diasHabilesEntre(hoyYmd, tutela.vencimiento);
  if (restantes <= DIAS_HABILES_AVISO_TUTELA && !tutela.alerta_por_vencer_enviada_at) {
    return "por_vencer";
  }
  return null;
}
