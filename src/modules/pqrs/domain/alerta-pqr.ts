import type { TipoAlertaTermino } from "../../../shared/infrastructure/email/alerta-terminos.layout.js";
import { diasHabilesEntre, sumarDiasHabiles } from "../../tutelas/domain/dias-habiles-co.js";

/** Término legal del derecho de petición (Ley 1755 de 2015, art. 14). */
export const DIAS_HABILES_TERMINO_PQR = 15;

export const DIAS_HABILES_AVISO_PQR = 2;

export function calcularVencimientoPqr(fechaRadicacionYmd: string): string {
  return sumarDiasHabiles(fechaRadicacionYmd, DIAS_HABILES_TERMINO_PQR);
}

export type EstadoAlertaPqr = {
  cerrada: boolean;
  vencimiento: string | null;
  alerta_por_vencer_enviada_at: Date | null;
  alerta_vencida_enviada_at: Date | null;
};

/** Qué alerta corresponde hoy (cada tipo se envía una sola vez por vencimiento). */
export function clasificarAlertaPqr(pqr: EstadoAlertaPqr, hoyYmd: string): TipoAlertaTermino | null {
  if (!pqr.vencimiento || pqr.cerrada) return null;

  if (pqr.vencimiento < hoyYmd) {
    return pqr.alerta_vencida_enviada_at ? null : "vencida";
  }

  const restantes = diasHabilesEntre(hoyYmd, pqr.vencimiento);
  if (restantes <= DIAS_HABILES_AVISO_PQR && !pqr.alerta_por_vencer_enviada_at) {
    return "por_vencer";
  }
  return null;
}
