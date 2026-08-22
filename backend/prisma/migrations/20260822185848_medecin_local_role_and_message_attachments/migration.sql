-- AlterEnum
ALTER TYPE "DocumentCategorie" ADD VALUE 'MESSAGERIE';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MEDECIN_LOCAL';

-- AlterTable
ALTER TABLE "Dossier" ADD COLUMN     "medecinLocalId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "documentId" TEXT;

-- CreateTable
CREATE TABLE "MedecinLocal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "specialite" TEXT,
    "etablissement" TEXT,
    "pays" TEXT,
    "numeroOrdre" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedecinLocal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MedecinLocal_userId_key" ON "MedecinLocal"("userId");

-- CreateIndex
CREATE INDEX "Dossier_medecinLocalId_idx" ON "Dossier"("medecinLocalId");

-- AddForeignKey
ALTER TABLE "MedecinLocal" ADD CONSTRAINT "MedecinLocal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_medecinLocalId_fkey" FOREIGN KEY ("medecinLocalId") REFERENCES "MedecinLocal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
