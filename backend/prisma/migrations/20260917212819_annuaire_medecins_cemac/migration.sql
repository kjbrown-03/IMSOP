-- CreateEnum
CREATE TYPE "RechercheAnnuaireStatut" AS ENUM ('FLOUTEE', 'DEBLOQUEE');

-- DropForeignKey
ALTER TABLE "Paiement" DROP CONSTRAINT "Paiement_dossierId_fkey";

-- AlterTable
ALTER TABLE "MedecinLocal" ADD COLUMN     "annuairePresentation" TEXT,
ADD COLUMN     "annuaireSpecialites" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "annuaireVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quartier" TEXT;

-- AlterTable
ALTER TABLE "Paiement" ADD COLUMN     "rechercheAnnuaireId" TEXT,
ALTER COLUMN "dossierId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RechercheAnnuaire" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "symptomes" TEXT NOT NULL,
    "specialites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pays" TEXT NOT NULL,
    "ville" TEXT,
    "urgence" BOOLEAN NOT NULL DEFAULT false,
    "statut" "RechercheAnnuaireStatut" NOT NULL DEFAULT 'FLOUTEE',
    "debloqueeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RechercheAnnuaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RechercheAnnuaireResultat" (
    "id" TEXT NOT NULL,
    "rechercheId" TEXT NOT NULL,
    "medecinId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RechercheAnnuaireResultat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RechercheAnnuaire_userId_idx" ON "RechercheAnnuaire"("userId");

-- CreateIndex
CREATE INDEX "RechercheAnnuaire_createdAt_idx" ON "RechercheAnnuaire"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RechercheAnnuaireResultat_rechercheId_medecinId_key" ON "RechercheAnnuaireResultat"("rechercheId", "medecinId");

-- CreateIndex
CREATE INDEX "Paiement_rechercheAnnuaireId_idx" ON "Paiement"("rechercheAnnuaireId");

-- AddForeignKey
ALTER TABLE "RechercheAnnuaire" ADD CONSTRAINT "RechercheAnnuaire_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RechercheAnnuaireResultat" ADD CONSTRAINT "RechercheAnnuaireResultat_rechercheId_fkey" FOREIGN KEY ("rechercheId") REFERENCES "RechercheAnnuaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RechercheAnnuaireResultat" ADD CONSTRAINT "RechercheAnnuaireResultat_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "MedecinLocal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_rechercheAnnuaireId_fkey" FOREIGN KEY ("rechercheAnnuaireId") REFERENCES "RechercheAnnuaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
