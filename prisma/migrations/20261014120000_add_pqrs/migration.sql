-- CreateTable
CREATE TABLE "pqrs" (
    "id" TEXT NOT NULL,
    "gestion" TEXT,
    "solicitante" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "fecha_radicacion" DATE NOT NULL,
    "radicado" TEXT,
    "vencimiento" DATE,
    "estado" TEXT,
    "cerrada" BOOLEAN NOT NULL DEFAULT false,
    "alerta_por_vencer_enviada_at" TIMESTAMP(3),
    "alerta_vencida_enviada_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pqrs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_pqrs_vencimiento" ON "pqrs"("vencimiento");
