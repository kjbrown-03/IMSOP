-- CreateEnum
CREATE TYPE "HonoraireStatut" AS ENUM ('A_REVERSER', 'EN_COURS', 'REVERSE', 'ECHOUE');

-- CreateTable
CREATE TABLE "Honoraire" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "specialisteId" TEXT NOT NULL,
    "montantBrut" DECIMAL(12,2) NOT NULL,
    "deviseBrut" TEXT NOT NULL DEFAULT 'XAF',
    "tauxCommission" DECIMAL(5,2) NOT NULL,
    "commission" DECIMAL(12,2) NOT NULL,
    "montantNet" DECIMAL(12,2) NOT NULL,
    "deviseNet" TEXT NOT NULL,
    "tauxChange" DECIMAL(12,6) NOT NULL,
    "montantNetDevise" DECIMAL(12,2) NOT NULL,
    "statut" "HonoraireStatut" NOT NULL DEFAULT 'A_REVERSER',
    "canal" TEXT NOT NULL,
    "referenceReversement" TEXT,
    "reverseLe" TIMESTAMP(3),
    "reversePar" TEXT,
    "motifEchec" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Honoraire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Honoraire_specialisteId_idx" ON "Honoraire"("specialisteId");

-- CreateIndex
CREATE INDEX "Honoraire_statut_idx" ON "Honoraire"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "Honoraire_dossierId_key" ON "Honoraire"("dossierId");

-- AddForeignKey
ALTER TABLE "Honoraire" ADD CONSTRAINT "Honoraire_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Honoraire" ADD CONSTRAINT "Honoraire_specialisteId_fkey" FOREIGN KEY ("specialisteId") REFERENCES "Specialiste"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

