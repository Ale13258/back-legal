import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient, type Role } from "@prisma/client";

const prisma = new PrismaClient();

const LEGALTECH_TENANT = {
  nombre: "LegalTech",
  tipo_persona: "juridica" as const,
  documento: "900000000-0",
  email: "tenant@legaltech.com",
  observaciones: "Tenant SaaS raíz (Fase 1–2)",
};

const DEFAULT_STAFF: Array<{ email: string; password: string; role: Role }> = [
  {
    email: process.env.SEED_ADMIN_EMAIL || "admin@legaltech.com",
    password: process.env.SEED_ADMIN_PASSWORD || "admin123",
    role: "super_admin",
  },
  { email: "operador@legaltech.com", password: "admin123", role: "analista_legal" },
  { email: "gestor@legaltech.com", password: "admin123", role: "abogada_junior" },
];

async function ensureLegalTechTenant() {
  const existing = await prisma.cliente.findFirst({
    where: {
      OR: [{ email: LEGALTECH_TENANT.email }, { documento: LEGALTECH_TENANT.documento }],
    },
  });
  if (existing) {
    return existing;
  }
  return prisma.cliente.create({
    data: {
      ...LEGALTECH_TENANT,
      is_active: true,
    },
  });
}

async function main() {
  const tenant = await ensureLegalTechTenant();
  console.log(`Tenant LegalTech listo: ${tenant.email} (${tenant.id})`);

  for (const staff of DEFAULT_STAFF) {
    const password_hash = await argon2.hash(staff.password);
    await prisma.usuario.upsert({
      where: { email: staff.email },
      update: {
        password_hash,
        role: staff.role,
        cliente_id: null,
        is_active: true,
        activated_at: new Date(),
        activation_token_hash: null,
        activation_expires_at: null,
      },
      create: {
        email: staff.email,
        password_hash,
        role: staff.role,
        cliente_id: null,
        is_active: true,
        activated_at: new Date(),
        activation_token_hash: null,
        activation_expires_at: null,
      },
    });
    console.log(`Staff seed listo: ${staff.email} (${staff.role})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
