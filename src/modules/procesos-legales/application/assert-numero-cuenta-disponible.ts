import { ApiError } from "../../../shared/http/error-handler.js";

export const NUMERO_RADICADO_DUPLICADO_MSG = "Ya existe un radicado con ese número";

export type ActiveProcesoByNumeroFinder = {
  findFirst(args: {
    where: {
      numero_cuenta: string;
      deleted_at: null;
      id?: { not: string };
    };
    select: { id: true };
  }): Promise<{ id: string } | null>;
};

/** Rechaza si otro proceso vivo ya usa el número. Ignora filas con deleted_at. */
export async function assertNumeroCuentaDisponible(
  repo: ActiveProcesoByNumeroFinder,
  numeroCuenta: string,
  excludeId?: string,
): Promise<void> {
  const existing = await repo.findFirst({
    where: {
      numero_cuenta: numeroCuenta,
      deleted_at: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new ApiError(409, "CONFLICT", NUMERO_RADICADO_DUPLICADO_MSG);
  }
}
