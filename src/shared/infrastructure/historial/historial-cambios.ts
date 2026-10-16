import type { HistorialCambio, Prisma } from "@prisma/client";
import { prisma } from "../prisma/prisma.client.js";

export type EntidadHistorial = "tutela" | "pqr";
export type AccionHistorial = "creada" | "actualizada" | "eliminada";
export type ValorHistorial = string | number | boolean | null;
export type CambioCampo = { campo: string; antes: ValorHistorial; despues: ValorHistorial };

type Db = Prisma.TransactionClient | typeof prisma;

function normalizar(value: unknown): ValorHistorial {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value.trim() === "" ? null : value.trim();
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

/** Campos que cambiaron entre dos versiones. Con `antes = null` (alta) lista los que tienen valor. */
export function diffCampos<T extends Record<string, unknown>>(
  antes: T | null,
  despues: T,
  campos: readonly (keyof T & string)[],
): CambioCampo[] {
  const cambios: CambioCampo[] = [];
  for (const campo of campos) {
    const a = antes ? normalizar(antes[campo]) : null;
    const d = normalizar(despues[campo]);
    if (a !== d) cambios.push({ campo, antes: a, despues: d });
  }
  return cambios;
}

export async function registrarHistorial(
  db: Db,
  input: {
    entidad: EntidadHistorial;
    registro_id: string;
    accion: AccionHistorial;
    cambios: CambioCampo[];
    usuario_email: string | null | undefined;
  },
): Promise<void> {
  if (input.accion === "actualizada" && input.cambios.length === 0) return;
  await db.historialCambio.create({
    data: {
      entidad: input.entidad,
      registro_id: input.registro_id,
      accion: input.accion,
      cambios: input.cambios,
      usuario_email: input.usuario_email ?? null,
    },
  });
}

export type HistorialResponse = {
  id: string;
  registro_id: string;
  accion: AccionHistorial;
  cambios: CambioCampo[];
  usuario_email: string | null;
  created_at: string;
};

export function toHistorialResponse(row: HistorialCambio): HistorialResponse {
  return {
    id: row.id,
    registro_id: row.registro_id,
    accion: row.accion as AccionHistorial,
    cambios: Array.isArray(row.cambios) ? (row.cambios as CambioCampo[]) : [],
    usuario_email: row.usuario_email,
    created_at: row.created_at.toISOString(),
  };
}

/** Historial en orden cronológico (más antiguo primero). */
export async function listarHistorial(
  entidad: EntidadHistorial,
  registroIds: string[],
): Promise<HistorialResponse[]> {
  if (registroIds.length === 0) return [];
  const rows = await prisma.historialCambio.findMany({
    where: { entidad, registro_id: { in: registroIds } },
    orderBy: { created_at: "asc" },
  });
  return rows.map(toHistorialResponse);
}
