-- DropForeignKey
ALTER TABLE "Dossier" DROP CONSTRAINT "Dossier_patientId_fkey";

-- AlterTable
ALTER TABLE "Dossier" ADD COLUMN     "demandeurMedecinId" TEXT,
ADD COLUMN     "patientAge" INTEGER,
ADD COLUMN     "patientSexe" TEXT,
ALTER COLUMN "patientId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Dossier_demandeurMedecinId_idx" ON "Dossier"("demandeurMedecinId");

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_demandeurMedecinId_fkey" FOREIGN KEY ("demandeurMedecinId") REFERENCES "MedecinLocal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
