/**
 * Fecha civil en zona horaria de negocio (evita usar `Date` local del servidor sin contexto).
 * Ver BACKEND_API_NODE_POSTGRES_AWS.md §6.5.1.
 */
const DEFAULT_TZ = "America/Bogota";

export function getBusinessTimeZone(): string {
  return process.env.BUSINESS_TIMEZONE?.trim() || DEFAULT_TZ;
}

/** YYYY-MM-DD de "hoy" en la zona configurada. */
export function getBusinessTodayYmd(now: Date = new Date()): string {
  return formatYmdInTimeZone(now, getBusinessTimeZone());
}

export function formatYmdInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}
