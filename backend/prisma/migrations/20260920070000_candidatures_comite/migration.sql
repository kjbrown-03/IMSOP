-- CreateEnum
CREATE TYPE "CandidatureType" AS ENUM ('SPECIALISTE', 'MEDECIN_LOCAL');

-- CreateEnum
CREATE TYPE "CandidatureStatut" AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE', 'COMPTE_CREE');

-- CreateTable
CREATE TABLE "Candidature" (
    "id" TEXT NOT NULL,
    "type" "CandidatureType" NOT NULL,
    "statut" "CandidatureStatut" NOT NULL DEFAULT 'EN_ATTENTE',
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "photoKey" TEXT NOT NULL,
    "specialite" TEXT NOT NULL,
    "etablissement" TEXT,
    "pays" TEXT,
    "ville" TEXT,
    "langues" TEXT,
    "numeroOrdre" TEXT,
    "presentation" TEXT NOT NULL,
    "motifRefus" TEXT,
    "decideParId" TEXT,
    "decideLe" TIMESTAMP(3),
    "compteUserId" TEXT,
    "compteCreeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Candidature_compteUserId_key" ON "Candidature"("compteUserId");

-- CreateIndex
CREATE INDEX "Candidature_statut_idx" ON "Candidature"("statut");

-- CreateIndex
CREATE INDEX "Candidature_email_idx" ON "Candidature"("email");

