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
    telefono: string | null;
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
    telefono: link.deudor.telefono,
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
 * Reutiliza deudor por documento, pero no pisa nombre/correo si otras unidades ya lo usan.
 * El nombre visible de cada unidad queda en cobro_* de la cuenta.
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
    const existing = await tx.deudor.findUnique({
      where: { documento: item.documento },
    });
    let deudor = existing;
    if (!existing) {
      deudor = await tx.deudor.create({
        data: {
          nombre: item.nombre,
          tipo_persona: item.tipo_persona,
          documento: item.documento,
          emails: item.emails,
          telefono: item.telefono ?? null,
        },
      });
    } else {
      // Si otras unidades ya usan este deudor, no pisar su nombre/correo.
      const otherLinks = await tx.cuentaDeudor.count({
        where: { deudor_id: existing.id },
      });
      if (otherLinks === 0) {
        deudor = await tx.deudor.update({
          where: { id: existing.id },
          data: {
            nombre: item.nombre,
            tipo_persona: item.tipo_persona,
            emails: item.emails,
            telefono: item.telefono ?? null,
          },
        });
      }
    }

    if (!deudor) {
      throw new Error("No se pudo resolver el deudor de cobro");
    }

    await tx.cuentaDeudor.create({
      data: {
        cuenta_id: input.cuentaId,
        deudor_id: deudor.id,
      },
    });

    linked.push({
      id: deudor.id,
      nombre: item.nombre,
      tipo_persona: item.tipo_persona,
      documento: item.documento,
      emails: [...item.emails],
      telefono: item.telefono ?? deudor.telefono,
    });
  }

  return linked;
}

export function cobroFieldsFromDeudores(deudores: DeudorCobro[]) {
  return cobroFromDeudor(deudores[0]!);
}
