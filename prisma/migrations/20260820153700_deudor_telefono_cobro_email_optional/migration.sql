-- AlterTable
ALTER TABLE "cuentas" ALTER COLUMN "cobro_email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "deudores" ADD COLUMN "telefono" TEXT;
