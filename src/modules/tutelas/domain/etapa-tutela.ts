import { sumarDiasHabiles } from "./dias-habiles-co.js";

/**
 * Término en días hábiles de cada etapa.
 * - `desde: "etapa"`: se cuenta desde el día en que la tutela entra a la etapa (`fecha_etapa`).
 * - `desde: "radicacion"`: se cuenta desde la fecha de radicación.
 * - `dias: null`: sin término automático (OTRO se escribe a mano; FINALIZADA no alerta).
 */
export const ETAPAS_TUTELA = [
  { value: "radicacion", label: "RADICACIÓN", dias: 3, desde: "etapa" },
  { value: "admision", label: "ADMISIÓN", dias: 3, desde: "etapa" },
  { value: "inadmision", label: "INADMISIÓN", dias: 2, desde: "etapa" },
  { value: "requerimiento", label: "REQUERIMIENTO", dias: 3, desde: "etapa" },
  { value: "sentencia", label: "SENTENCIA", dias: 10, desde: "radicacion" },
  { value: "impugnacion", label: "IMPUGNACIÓN", dias: 3, desde: "etapa" },
  { value: "desacato", label: "DESACATO", dias: 3, desde: "etapa" },
  { value: "admite_impugnacion", label: "ADMITE IMPUG", dias: 10, desde: "etapa" },
  { value: "otro", label: "OTRO", dias: null, desde: null },
  { value: "finalizada", label: "FINALIZADA", dias: null, desde: null },
] as const;

export type EtapaTutela = (typeof ETAPAS_TUTELA)[number]["value"];

export const ETAPA_TUTELA_VALUES = ETAPAS_TUTELA.map((e) => e.value) as [
  EtapaTutela,
  ...EtapaTutela[],
];

export const ETAPA_TUTELA_LABELS: Record<EtapaTutela, string> = Object.fromEntries(
  ETAPAS_TUTELA.map((e) => [e.value, e.label]),
) as Record<EtapaTutela, string>;

export const ETAPAS_TUTELA_SIN_ALERTA: readonly EtapaTutela[] = ["finalizada"];

/** `null` cuando la etapa no tiene término automático o falta la fecha base. */
export function calcularVencimientoEtapa(input: {
  etapa: EtapaTutela;
  fecha_etapa: string | null;
  fecha_radicacion: string | null;
}): string | null {
  const regla = ETAPAS_TUTELA.find((e) => e.value === input.etapa);
  if (!regla || regla.dias === null) return null;
  const base = regla.desde === "radicacion" ? input.fecha_radicacion : input.fecha_etapa;
  return base ? sumarDiasHabiles(base, regla.dias) : null;
}
