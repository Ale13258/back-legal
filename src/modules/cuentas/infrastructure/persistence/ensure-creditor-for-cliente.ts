import type { Prisma } from "@prisma/client";
import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";

export const LEGALTECH_TENANT_EMAIL = "tenant@legaltech.com";
export const LEGALTECH_TENANT_DOCUMENTO = "900000000-0";
export const LEGALTECH_TENANT_NOMBRE = "LegalTech";

type Tx = Prisma.TransactionClient;

async function ensureLegalTechTenant(db: Tx | typeof prisma = prisma) {
  const existing = await db.cliente.findFirst({
    where: {
      OR: [{ email: LEGALTECH_TENANT_EMAIL }, { documento: LEGALTECH_TENANT_DOCUMENTO }],
    },
  });
  if (existing) {
    return existing;
  }

  return db.cliente.create({
    data: {
      nombre: LEGALTECH_TENANT_NOMBRE,
      tipo_persona: "juridica",
      documento: LEGALTECH_TENANT_DOCUMENTO,
      email: LEGALTECH_TENANT_EMAIL,
      observaciones: "Tenant SaaS raíz (Fase 1–2)",
      is_active: true,
    },
  });
}

/**
 * Resuelve el acreedor bajo el tenant LegalTech a partir del cliente legacy
 * que aún usa el API (`cuentas.cliente_id`).
 */
export async function ensureCreditorForLegacyCliente(
  legacyClienteId: string,
  db: Tx | typeof prisma = prisma,
): Promise<{ id: string }> {
  const legacy = await db.cliente.findUnique({ where: { id: legacyClienteId } });
  if (!legacy) {
    throw new Error(`Cliente legacy no encontrado: ${legacyClienteId}`);
  }

  const tenant = await ensureLegalTechTenant(db);

  const existing = await db.creditor.findFirst({
    where: {
      cliente_id: tenant.id,
      documento: legacy.documento,
    },
    select: { id: true },
  });
  if (existing) {
    return existing;
  }

  return db.creditor.create({
    data: {
      cliente_id: tenant.id,
      nombre: legacy.nombre,
      tipo_persona: legacy.tipo_persona,
      documento: legacy.documento,
      telefono: legacy.telefono,
      email: legacy.email,
      direccion: legacy.direccion,
      observaciones: legacy.observaciones,
      is_active: legacy.is_active,
    },
    select: { id: true },
  });
}
