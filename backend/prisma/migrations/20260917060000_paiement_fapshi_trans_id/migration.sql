-- AlterTable
ALTER TABLE "Paiement" ADD COLUMN     "fapshiTransId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_fapshiTransId_key" ON "Paiement"("fapshiTransId");
