-- Demandes d'ajout de maladies prises en charge par un tradipraticien, et leurs
-- pièces justificatives. Aucune table existante n'est modifiée.
CREATE TYPE "StatutDemandePriseEnCharge" AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE');

CREATE TABLE "DemandePriseEnCharge" (
    "id" TEXT NOT NULL,
    "medecinLocalId" TEXT NOT NULL,
    "specialites" TEXT[],
    "motif" TEXT NOT NULL,
    "statut" "StatutDemandePriseEnCharge" NOT NULL DEFAULT 'EN_ATTENTE',
    "motifRefus" TEXT,
    "traiteParId" TEXT,
    "traiteLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandePriseEnCharge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PieceDemandePriseEnCharge" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PieceDemandePriseEnCharge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DemandePriseEnCharge_statut_createdAt_idx" ON "DemandePriseEnCharge"("statut", "createdAt");
CREATE INDEX "DemandePriseEnCharge_medecinLocalId_createdAt_idx" ON "DemandePriseEnCharge"("medecinLocalId", "createdAt");
CREATE INDEX "PieceDemandePriseEnCharge_demandeId_idx" ON "PieceDemandePriseEnCharge"("demandeId");

ALTER TABLE "DemandePriseEnCharge" ADD CONSTRAINT "DemandePriseEnCharge_medecinLocalId_fkey" FOREIGN KEY ("medecinLocalId") REFERENCES "MedecinLocal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PieceDemandePriseEnCharge" ADD CONSTRAINT "PieceDemandePriseEnCharge_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "DemandePriseEnCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
