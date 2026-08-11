/**
 * Etapas del proceso judicial de radicación (cuenta de cartera).
 * Alineado con legal_angular2/src/app/core/proceso-etapas.ts
 */

export const ETAPAS_PROCESO_ORDENADAS = [
  { value: "radicacion", label: "RADICACIÓN" },
  { value: "inadmision", label: "INADMISIÓN" },
  { value: "subsanacion", label: "SUBSANACIÓN" },
  { value: "mandamiento_de_pago", label: "MANDAMIENTO DE PAGO" },
  { value: "medidas_radicadas", label: "MEDIDAS RADICADAS" },
  { value: "notificacion", label: "NOTIFICACIÓN" },
  { value: "sentencia", label: "SENTENCIA" },
  { value: "liquidacion_de_costas", label: "LIQUIDACIÓN DE COSTAS" },
  { value: "ejecucion", label: "EJECUCIÓN" },
  { value: "liquidacion_del_credito", label: "LIQUIDACIÓN DEL CRÉDITO" },
  { value: "remate", label: "REMATE" },
  { value: "rechazado", label: "RECHAZADO" },
  { value: "terminacion", label: "TERMINACIÓN" },
] as const;

export type EtapaProcesoSlug = (typeof ETAPAS_PROCESO_ORDENADAS)[number]["value"];

export const ETAPA_PROCESO_DEFAULT: EtapaProcesoSlug = "radicacion";

export const ETAPA_PROCESO_VALUES = ETAPAS_PROCESO_ORDENADAS.map(
  (e) => e.value,
) as [EtapaProcesoSlug, ...EtapaProcesoSlug[]];

const ETAPA_VALUES = new Set<string>(ETAPA_PROCESO_VALUES);

export const ETAPA_PROCESO_LABELS: Record<EtapaProcesoSlug, string> = Object.fromEntries(
  ETAPAS_PROCESO_ORDENADAS.map((e) => [e.value, e.label]),
) as Record<EtapaProcesoSlug, string>;

/** Slugs legacy pre-migración (solo lectura / respuestas antiguas en cache). */
const LEGACY_TO_ETAPA: Record<string, EtapaProcesoSlug> = {
  inicial: "radicacion",
  conciliacion: "subsanacion",
  demanda: "mandamiento_de_pago",
};

export function isEtapaProceso(value: string): value is EtapaProcesoSlug {
  return ETAPA_VALUES.has(value);
}

export function coerceLegacyEtapaProceso(value: unknown): EtapaProcesoSlug {
  const s = String(value ?? "").trim();
  if (isEtapaProceso(s)) return s;
  const mapped = LEGACY_TO_ETAPA[s];
  if (mapped) return mapped;
  return ETAPA_PROCESO_DEFAULT;
}
