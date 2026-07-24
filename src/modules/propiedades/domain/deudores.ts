import type {
  CobroFields,
  DeudorCobro,
  TipoPersona,
} from "./ports/propiedades-persistence.port.js";

export type { DeudorCobro };

export function cobroFromDeudor(deudor: DeudorCobro): CobroFields {
  return {
    cobro_nombre: deudor.nombre,
    cobro_tipo_persona: deudor.tipo_persona,
    cobro_documento: deudor.documento,
    cobro_email: deudor.emails[0] ?? "",
  };
}

export function deudorFromCobro(cobro: CobroFields): DeudorCobro {
  return {
    nombre: cobro.cobro_nombre,
    tipo_persona: cobro.cobro_tipo_persona,
    documento: cobro.cobro_documento,
    emails: [cobro.cobro_email],
  };
}

export function normalizeDeudor(raw: DeudorCobro): DeudorCobro {
  return {
    nombre: raw.nombre.trim(),
    tipo_persona: raw.tipo_persona,
    documento: raw.documento.trim(),
    emails: raw.emails.map((e) => e.trim()).filter(Boolean),
  };
}

export function normalizeDeudores(raw: DeudorCobro[]): DeudorCobro[] {
  return raw.map(normalizeDeudor);
}

export function findDuplicateDocumentoIndexes(deudores: DeudorCobro[]): number[] {
  const seen = new Map<string, number>();
  const duplicates: number[] = [];
  deudores.forEach((d, i) => {
    const key = d.documento.trim().toLowerCase();
    if (!key) return;
    const first = seen.get(key);
    if (first !== undefined) {
      duplicates.push(i);
    } else {
      seen.set(key, i);
    }
  });
  return duplicates;
}

function isTipoPersona(value: unknown): value is TipoPersona {
  return value === "natural" || value === "juridica";
}

function coerceEmails(row: Record<string, unknown>): string[] | null {
  if (Array.isArray(row.emails)) {
    if (row.emails.length < 1) return null;
    if (!row.emails.every((e) => typeof e === "string" && e.trim().length > 0)) return null;
    return row.emails.map((e) => (e as string).trim());
  }
  // Legacy: email singular guardado en la primera migración de deudores
  if (typeof row.email === "string" && row.email.trim()) {
    return [row.email.trim()];
  }
  return null;
}

function coerceDeudorCobro(value: unknown): DeudorCobro | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.nombre !== "string") return null;
  if (!isTipoPersona(row.tipo_persona)) return null;
  if (typeof row.documento !== "string") return null;
  const emails = coerceEmails(row);
  if (!emails) return null;
  return {
    nombre: row.nombre,
    tipo_persona: row.tipo_persona,
    documento: row.documento,
    emails,
  };
}

/** Parsea JSON persistido; null si inválido o vacío. Acepta legacy `email`. */
export function parseStoredDeudores(value: unknown): DeudorCobro[] | null {
  if (!Array.isArray(value) || value.length < 1) return null;
  const coerced: DeudorCobro[] = [];
  for (const item of value) {
    const d = coerceDeudorCobro(item);
    if (!d) return null;
    coerced.push(d);
  }
  return normalizeDeudores(coerced);
}

/** Siempre devuelve len >= 1 a partir de deudores persistidos o cobro_* legacy. */
export function ensureDeudores(stored: unknown, cobro: CobroFields): DeudorCobro[] {
  const parsed = parseStoredDeudores(stored);
  if (parsed) return parsed;
  return [normalizeDeudor(deudorFromCobro(cobro))];
}

/** Actualiza deudores[0] con patch parcial de cobro_* (legacy). */
export function patchPrimaryDeudor(
  existingDeudores: DeudorCobro[],
  patch: Partial<CobroFields>,
): DeudorCobro[] {
  const current =
    existingDeudores.length > 0
      ? existingDeudores
      : [
          {
            nombre: "",
            tipo_persona: "natural" as TipoPersona,
            documento: "",
            emails: [""],
          },
        ];
  const primary = {
    ...current[0]!,
    emails: [...(current[0]!.emails.length ? current[0]!.emails : [""])],
  };
  if (patch.cobro_nombre !== undefined) primary.nombre = patch.cobro_nombre.trim();
  if (patch.cobro_tipo_persona !== undefined) primary.tipo_persona = patch.cobro_tipo_persona;
  if (patch.cobro_documento !== undefined) primary.documento = patch.cobro_documento.trim();
  if (patch.cobro_email !== undefined) {
    const rest = primary.emails.slice(1);
    primary.emails = [patch.cobro_email.trim(), ...rest];
  }
  return [normalizeDeudor(primary), ...current.slice(1)];
}
