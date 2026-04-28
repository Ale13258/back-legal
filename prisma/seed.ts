import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@legaltech.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const password_hash = await argon2.hash(adminPassword);

  await prisma.usuario.upsert({
    where: { email: adminEmail },
    update: { password_hash, role: "admin", cliente_id: null },
    create: { email: adminEmail, password_hash, role: "admin", cliente_id: null },
  });

  console.log(`Admin seed listo: ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
