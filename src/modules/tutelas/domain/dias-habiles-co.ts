/**
 * Días hábiles en Colombia (lunes a viernes sin festivos, Ley 51 de 1983).
 * Todas las fechas son civiles `YYYY-MM-DD`; la aritmética se hace en UTC para no depender del huso del servidor.
 */

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseYmd(ymd: string): Date {
  const m = YMD_RE.exec(ymd);
  if (!m) throw new Error(`Fecha inválida (se espera YYYY-MM-DD): ${ymd}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = parseYmd(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return toYmd(d);
}

/** Domingo de Pascua (algoritmo gregoriano anónimo). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function nextMondayOrSame(date: Date): Date {
  const d = new Date(date);
  const offset = (8 - d.getUTCDay()) % 7;
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

function plusDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const festivosCache = new Map<number, Set<string>>();

export function festivosColombia(year: number): Set<string> {
  const cached = festivosCache.get(year);
  if (cached) return cached;

  const fixed = (month: number, day: number) => new Date(Date.UTC(year, month - 1, day));
  const easter = easterSunday(year);

  const dates: Date[] = [
    fixed(1, 1),
    fixed(5, 1),
    fixed(7, 20),
    fixed(8, 7),
    fixed(12, 8),
    fixed(12, 25),
    plusDays(easter, -3),
    plusDays(easter, -2),
    ...[
      fixed(1, 6),
      fixed(3, 19),
      fixed(6, 29),
      fixed(8, 15),
      fixed(10, 12),
      fixed(11, 1),
      fixed(11, 11),
      plusDays(easter, 39),
      plusDays(easter, 60),
      plusDays(easter, 68),
    ].map(nextMondayOrSame),
  ];

  const set = new Set(dates.map(toYmd));
  festivosCache.set(year, set);
  return set;
}

export function esDiaHabil(ymd: string): boolean {
  const d = parseYmd(ymd);
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !festivosColombia(d.getUTCFullYear()).has(ymd);
}

/** Suma `n` días hábiles contando desde el día siguiente a `ymd`. */
export function sumarDiasHabiles(ymd: string, n: number): string {
  let current = ymd;
  let remaining = n;
  while (remaining > 0) {
    current = addDaysYmd(current, 1);
    if (esDiaHabil(current)) remaining -= 1;
  }
  return current;
}

/**
 * Días hábiles en el intervalo (desde, hasta]. Si `hasta` es anterior a `desde` devuelve el negativo
 * de los hábiles en (hasta, desde].
 */
export function diasHabilesEntre(desdeYmd: string, hastaYmd: string): number {
  if (hastaYmd === desdeYmd) return 0;
  const forward = hastaYmd > desdeYmd;
  const [start, end] = forward ? [desdeYmd, hastaYmd] : [hastaYmd, desdeYmd];
  let count = 0;
  let current = start;
  while (current < end) {
    current = addDaysYmd(current, 1);
    if (esDiaHabil(current)) count += 1;
  }
  return forward ? count : 0 - count;
}

export const DIAS_HABILES_TERMINO_TUTELA = 10;

export function calcularVencimientoTutela(fechaRadicacionYmd: string): string {
  return sumarDiasHabiles(fechaRadicacionYmd, DIAS_HABILES_TERMINO_TUTELA);
}
