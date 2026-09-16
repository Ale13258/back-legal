import type { Prisma } from "@prisma/client";
import type { DeudorCobro, TipoPersona } from "../../domain/ports/cuentas-persistence.port.js";
import {
  cobroFromDeudor,
  isReusableDeudorDocumento,
  normalizeDeudores,
  sameDocumento,
} from "../../domain/deudores.js";

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

type PreviousLink = {
  deudor_id: string;
  deudor: {
    cliente_id: string;
    documento: string;
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

function deudorWriteData(clienteId: string, item: DeudorCobro) {
  return {
    cliente_id: clienteId,
    nombre: item.nombre,
    tipo_persona: item.tipo_persona,
    documento: item.documento,
    emails: item.emails,
    telefono: item.telefono ?? null,
  };
}

/** Vínculos a otras unidades vivas. Las borradas no cuentan: se puede recrear la misma. */
export function otherActiveCuentaDeudorWhere(deudorId: string, cuentaId: string) {
  return {
    deudor_id: deudorId,
    cuenta_id: { not: cuentaId },
    cuenta: { deleted_at: null },
  };
}

async function otherCuentaLinks(
  tx: Prisma.TransactionClient,
  deudorId: string,
  cuentaId: string,
): Promise<number> {
  return tx.cuentaDeudor.count({
    where: otherActiveCuentaDeudorWhere(deudorId, cuentaId),
  });
}

async function resolveDeudorForSync(
  tx: Prisma.TransactionClient,
  input: {
    clienteId: string;
    cuentaId: string;
    item: DeudorCobro;
    previousLinks: PreviousLink[];
  },
) {
  const { clienteId, cuentaId, item, previousLinks } = input;

  if (isReusableDeudorDocumento(item.documento)) {
    const existing = await tx.deudor.findFirst({
      where: { cliente_id: clienteId, documento: item.documento },
    });
    if (!existing) {
      return tx.deudor.create({ data: deudorWriteData(clienteId, item) });
    }
    if ((await otherCuentaLinks(tx, existing.id, cuentaId)) === 0) {
      return tx.deudor.update({
        where: { id: existing.id },
        data: {
          nombre: item.nombre,
          tipo_persona: item.tipo_persona,
          emails: item.emails,
          telefono: item.telefono ?? null,
        },
      });
    }
    return existing;
  }

  const previous = previousLinks.find(
    (link) =>
      link.deudor.cliente_id === clienteId &&
      sameDocumento(link.deudor.documento, item.documento),
  );
  if (previous && (await otherCuentaLinks(tx, previous.deudor_id, cuentaId)) === 0) {
    return tx.deudor.update({
      where: { id: previous.deudor_id },
      data: {
        nombre: item.nombre,
        tipo_persona: item.tipo_persona,
        documento: item.documento,
        emails: item.emails,
        telefono: item.telefono ?? null,
      },
    });
  }

  return tx.deudor.create({ data: deudorWriteData(clienteId, item) });
}

/**
 * Reemplaza los vínculos de una cuenta.
 * Reutiliza deudor por documento solo dentro del mismo conjunto y si el
 * documento no es placeholder. El correo visible de cada unidad queda en cobro_*.
 */
export async function syncCuentaDeudores(
  tx: Prisma.TransactionClient,
  input: {
    cuentaId: string;
    clienteId: string;
    deudores: DeudorCobro[];
  },
): Promise<DeudorCobro[]> {
  const deudores = normalizeDeudores(input.deudores);

  const previousLinks = await tx.cuentaDeudor.findMany({
    where: { cuenta_id: input.cuentaId },
    select: {
      deudor_id: true,
      deudor: { select: { cliente_id: true, documento: true } },
    },
  });

  await tx.cuentaDeudor.deleteMany({ where: { cuenta_id: input.cuentaId } });

  const linked: DeudorCobro[] = [];
  for (const item of deudores) {
    const deudor = await resolveDeudorForSync(tx, {
      clienteId: input.clienteId,
      cuentaId: input.cuentaId,
      item,
      previousLinks,
    });

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
