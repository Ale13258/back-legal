import type {
  CobroFields,
  DeudorCobro,
  TipoPersona,
} from "./ports/cuentas-persistence.port.js";

export type { DeudorCobro };

export function cobroFromDeudor(deudor: DeudorCobro): CobroFields {
  return {
    cobro_nombre: deudor.nombre,
    cobro_tipo_persona: deudor.tipo_persona,
    cobro_documento: deudor.documento,
    cobro_email: deudor.emails[0] ?? null,
  };
}

/** Clave para saber si dos documentos son la misma persona (puntos/guiones no cuentan). */
export function documentoKey(documento: string): string {
  const trimmed = documento.trim().toLowerCase();
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 5 ? digits : trimmed;
}

function sameDocumento(a: string, b: string): boolean {
  const ka = documentoKey(a);
  const kb = documentoKey(b);
  return ka.length > 0 && ka === kb;
}

/**
 * El deudor maestro es reutilizable entre unidades. El nombre/correo de *esta*
 * cuenta viven en cobro_*: si coinciden el documento, esa ficha gana.
 */
export function overlayPrimaryFromCobroSnapshot(
  deudores: DeudorCobro[],
  cobro: CobroFields,
): DeudorCobro[] {
  const snapshot = normalizeDeudor(deudorFromCobro(cobro));
  if (!deudores.length) return [snapshot];
  if (deudores.length > 1) return deudores;
  const idx = deudores.findIndex((d) => sameDocumento(d.documento, snapshot.documento));
  if (idx < 0) return deudores;
  const current = deudores[idx]!;
  const primaryEmail = snapshot.emails[0];
  const emails = primaryEmail
    ? [
        primaryEmail,
        ...current.emails.filter((e) => e.toLowerCase() !== primaryEmail.toLowerCase()),
      ]
    : current.emails;
  const primary: DeudorCobro = {
    ...current,
    nombre: snapshot.nombre || current.nombre,
    tipo_persona: snapshot.tipo_persona,
    documento: snapshot.documento || current.documento,
    emails,
    telefono: current.telefono ?? snapshot.telefono ?? null,
  };
  return [primary, ...deudores.filter((_, i) => i !== idx)];
}

export function deudorFromCobro(cobro: CobroFields): DeudorCobro {
  const email = cobro.cobro_email?.trim();
  return {
    nombre: cobro.cobro_nombre,
    tipo_persona: cobro.cobro_tipo_persona,
    documento: cobro.cobro_documento,
    emails: email ? [email] : [],
  };
}

function normalizeTelefono(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeDeudor(raw: DeudorCobro): DeudorCobro {
  return {
    nombre: raw.nombre.trim(),
    tipo_persona: raw.tipo_persona,
    documento: raw.documento.trim(),
    emails: raw.emails.map((e) => e.trim()).filter(Boolean),
    telefono: normalizeTelefono(raw.telefono),
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
    if (!row.emails.every((e) => typeof e === "string" && e.trim().length > 0)) {
      // Allow empty array; reject non-string / blank entries
      if (row.emails.length === 0) return [];
      return null;
    }
    return row.emails.map((e) => (e as string).trim());
  }
  // Legacy: email singular guardado en la primera migración de deudores
  if (typeof row.email === "string" && row.email.trim()) {
    return [row.email.trim()];
  }
  if (row.emails === undefined && row.email === undefined) {
    return [];
  }
  return null;
}

function coerceTelefono(row: Record<string, unknown>): string | null | undefined {
  if (row.telefono === undefined) return undefined;
  if (row.telefono === null) return null;
  if (typeof row.telefono !== "string") return undefined;
  return row.telefono;
}

function coerceDeudorCobro(value: unknown): DeudorCobro | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.nombre !== "string") return null;
  if (!isTipoPersona(row.tipo_persona)) return null;
  if (typeof row.documento !== "string") return null;
  const emails = coerceEmails(row);
  if (!emails) return null;
  const telefono = coerceTelefono(row);
  return {
    nombre: row.nombre,
    tipo_persona: row.tipo_persona,
    documento: row.documento,
    emails,
    ...(telefono !== undefined ? { telefono } : {}),
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
            emails: [],
            telefono: null,
          },
        ];
  const primary = {
    ...current[0]!,
    emails: [...current[0]!.emails],
  };
  if (patch.cobro_nombre !== undefined) primary.nombre = patch.cobro_nombre.trim();
  if (patch.cobro_tipo_persona !== undefined) primary.tipo_persona = patch.cobro_tipo_persona;
  if (patch.cobro_documento !== undefined) primary.documento = patch.cobro_documento.trim();
  if (patch.cobro_email !== undefined) {
    const email = patch.cobro_email?.trim() ?? "";
    if (email) {
      const rest = primary.emails.slice(1);
      primary.emails = [email, ...rest];
    } else {
      primary.emails = [];
    }
  }
  return [normalizeDeudor(primary), ...current.slice(1)];
}
