import type { EstadoPago } from "./ports/propiedades-persistence.port.js";

/**
 * Regla documentada en BACKEND_API_NODE_POSTGRES_AWS.md §6.5.1 (fuente de verdad).
 *
 * - `periodo` es YYYY-MM del periodo facturado. Se asume vencimiento al último día de ese mes.
 * - La mora cuenta desde el día **siguiente** a ese vencimiento.
 * - Si `estado_pago` es `pagado` y hay `fecha_pago`, el cómputo termina ese día (inclusive).
 * - En `pendiente`, `parcial` y `vencido` el cómputo llega hasta `referenceTodayYmd` (fecha civil negocio).
 * - Si `pagado` sin `fecha_pago`, no hay fecha de cierre fiable → 0 días (conservador).
 * - Días en mora: conteo inclusivo de días calendario entre inicio y fin (ambos incluidos).
 */
export type ComputeDiasEnMoraInput = {
  periodo: string;
  estado_pago: EstadoPago;
  fecha_pago: Date | null;
  /** YYYY-MM-DD en zona de negocio; inyectable en tests. */
  referenceTodayYmd: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Último día del mes del periodo YYYY-MM, como YYYY-MM-DD (UTC civil). */
export function lastDayYmdOfPeriod(periodo: string): string {
  const m = periodo.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error(`periodo invalido: ${periodo}`);
  const y = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error(`periodo invalido: ${periodo}`);
  const last = new Date(Date.UTC(y, month, 0));
  const d = last.getUTCDate();
  return `${y}-${pad2(month)}-${pad2(d)}`;
}

export function addDaysToYmd(ymd: string, deltaDays: number): string {
  const [ys, ms, ds] = ymd.split("-").map(Number);
  const t = Date.UTC(ys, ms - 1, ds + deltaDays, 12, 0, 0);
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function compareYmd(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Fecha almacenada @db.Date → YYYY-MM-DD en UTC (componentes UTC del instante). */
export function dateToYmdUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Días inclusivos entre dos YYYY-MM-DD; si fin < inicio → 0. */
export function inclusiveCalendarDays(startYmd: string, endYmd: string): number {
  if (compareYmd(endYmd, startYmd) < 0) return 0;
  const [ys, ms, ds] = startYmd.split("-").map(Number);
  const [ye, me, de] = endYmd.split("-").map(Number);
  const s = Date.UTC(ys, ms - 1, ds, 12, 0, 0);
  const e = Date.UTC(ye, me - 1, de, 12, 0, 0);
  const diff = Math.round((e - s) / 86400000);
  return diff + 1;
}

export function moraStartYmdForPeriod(periodo: string): string {
  const last = lastDayYmdOfPeriod(periodo);
  return addDaysToYmd(last, 1);
}

export function computeDiasEnMora(input: ComputeDiasEnMoraInput): number {
  const moraStart = moraStartYmdForPeriod(input.periodo);

  let endYmd: string;
  if (input.estado_pago === "pagado") {
    if (!input.fecha_pago) return 0;
    endYmd = dateToYmdUtc(input.fecha_pago);
  } else {
    endYmd = input.referenceTodayYmd;
  }

  if (compareYmd(endYmd, moraStart) < 0) return 0;
  return inclusiveCalendarDays(moraStart, endYmd);
}
