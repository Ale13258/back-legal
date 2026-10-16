-- AlterTable
ALTER TABLE "pqrs" ADD COLUMN "responsable_id" TEXT;

-- CreateIndex
CREATE INDEX "idx_pqrs_responsable" ON "pqrs"("responsable_id");

-- AddForeignKey
ALTER TABLE "pqrs" ADD CONSTRAINT "pqrs_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
