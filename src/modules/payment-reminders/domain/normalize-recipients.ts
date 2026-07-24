/** Parte una lista legacy "a@x.com, b@y.com" o "a; b". */
export function splitEmailList(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Contrato nuevo: cliente_email = un solo email; extras en array.
 * Datos viejos con CSV en cliente_email se normalizan al leer (split → principal + extras).
 */
export function normalizeReminderRecipients(
  clienteEmail: string,
  extraRecipients: string[] | null | undefined,
): { cliente_email: string; extra_recipients: string[] } {
  const fromPrimary = splitEmailList(clienteEmail);
  const fromExtras = (extraRecipients ?? []).flatMap(splitEmailList);
  const seen = new Set<string>();
  const all: string[] = [];
  for (const raw of [...fromPrimary, ...fromExtras]) {
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(raw);
  }
  return {
    cliente_email: all[0] ?? "",
    extra_recipients: all.slice(1),
  };
}

export function mergeRecipientList(primary: string, extras?: string[]): string {
  const { cliente_email, extra_recipients } = normalizeReminderRecipients(primary, extras);
  return [cliente_email, ...extra_recipients].filter(Boolean).join(", ");
}

export const GESTION_ORIGEN_EMAIL_REMINDER = "email_reminder" as const;
