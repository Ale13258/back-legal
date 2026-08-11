import type { Prisma } from "@prisma/client";
import type { DeudorCobro, TipoPersona } from "../../domain/ports/cuentas-persistence.port.js";
import { cobroFromDeudor, normalizeDeudores } from "../../domain/deudores.js";

export const cuentaDeudoresInclude = {
  cuenta_deudores: {
    include: {
      deudor: true,
    },
  },
} satisfies Prisma.CuentaInclude;

type CuentaDeudorRow = {
  deudor: {
    id: string;
    nombre: string;
    tipo_persona: TipoPersona;
    documento: string;
    emails: string[];
  };
};

/** El deudor principal (cobro_*) va primero; el resto sin orden fijo. */
export function deudoresFromLinks(
  links: CuentaDeudorRow[],
  cobroDocumento?: string,
): DeudorCobro[] {
  const mapped = links.map((link) => ({
    id: link.deudor.id,
    nombre: link.deudor.nombre,
    tipo_persona: link.deudor.tipo_persona,
    documento: link.deudor.documento,
    emails: [...link.deudor.emails],
  }));
  if (!cobroDocumento) return mapped;
  return [...mapped].sort((a, b) => {
    if (a.documento === cobroDocumento) return -1;
    if (b.documento === cobroDocumento) return 1;
    return a.documento.localeCompare(b.documento);
  });
}

/**
 * Reemplaza los vínculos de una cuenta.
 * Upsert de deudor por documento (reutilizable en otras cuentas).
 * La intermedia solo guarda cuenta_id + deudor_id.
 */
export async function syncCuentaDeudores(
  tx: Prisma.TransactionClient,
  input: {
    cuentaId: string;
    deudores: DeudorCobro[];
  },
): Promise<DeudorCobro[]> {
  const deudores = normalizeDeudores(input.deudores);

  await tx.cuentaDeudor.deleteMany({ where: { cuenta_id: input.cuentaId } });

  const linked: DeudorCobro[] = [];
  for (const item of deudores) {
    const deudor = await tx.deudor.upsert({
      where: { documento: item.documento },
      create: {
        nombre: item.nombre,
        tipo_persona: item.tipo_persona,
        documento: item.documento,
        emails: item.emails,
      },
      update: {
        nombre: item.nombre,
        tipo_persona: item.tipo_persona,
        emails: item.emails,
      },
    });

    await tx.cuentaDeudor.create({
      data: {
        cuenta_id: input.cuentaId,
        deudor_id: deudor.id,
      },
    });

    linked.push({
      id: deudor.id,
      nombre: deudor.nombre,
      tipo_persona: deudor.tipo_persona,
      documento: deudor.documento,
      emails: [...deudor.emails],
    });
  }

  return linked;
}

export function cobroFieldsFromDeudores(deudores: DeudorCobro[]) {
  return cobroFromDeudor(deudores[0]!);
}
