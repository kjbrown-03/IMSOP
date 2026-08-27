-- CreateEnum
CREATE TYPE "TemoignageStatut" AS ENUM ('EN_ATTENTE', 'PUBLIE', 'REJETE');

-- AlterTable
ALTER TABLE "Dossier" ADD COLUMN     "questionMedecinLocal" TEXT,
ADD COLUMN     "questionMedecinLocalPoseeLe" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Temoignage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleAuteur" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "note" INTEGER,
    "statut" "TemoignageStatut" NOT NULL DEFAULT 'EN_ATTENTE',
    "motifRejet" TEXT,
    "moderePar" TEXT,
    "modereLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Temoignage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Temoignage_userId_idx" ON "Temoignage"("userId");

-- CreateIndex
CREATE INDEX "Temoignage_statut_idx" ON "Temoignage"("statut");

-- AddForeignKey
ALTER TABLE "Temoignage" ADD CONSTRAINT "Temoignage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Temoignage" ADD CONSTRAINT "Temoignage_moderePar_fkey" FOREIGN KEY ("moderePar") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
