-- CreateTable
CREATE TABLE "historial_cambios" (
    "id" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "registro_id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "cambios" JSONB NOT NULL,
    "usuario_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_cambios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_historial_registro" ON "historial_cambios"("entidad", "registro_id", "created_at");
