-- CreateEnum
CREATE TYPE "etapa_tutela_enum" AS ENUM ('radicada', 'admitida', 'requiere_informe', 'fallo', 'impugnada', 'incidente', 'archivada');

-- CreateTable
CREATE TABLE "tutelas" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT,
    "fecha_radicacion" DATE,
    "radicado" TEXT,
    "juzgado" TEXT,
    "accionante" TEXT NOT NULL,
    "accionado" TEXT NOT NULL,
    "derecho" TEXT NOT NULL DEFAULT 'PETICION',
    "vencimiento" DATE,
    "etapa" "etapa_tutela_enum" NOT NULL DEFAULT 'radicada',
    "observaciones" TEXT,
    "alerta_por_vencer_enviada_at" TIMESTAMP(3),
    "alerta_vencida_enviada_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutelas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_tutelas_cliente" ON "tutelas"("cliente_id");

-- CreateIndex
CREATE INDEX "idx_tutelas_vencimiento" ON "tutelas"("vencimiento");

-- AddForeignKey
ALTER TABLE "tutelas" ADD CONSTRAINT "tutelas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

