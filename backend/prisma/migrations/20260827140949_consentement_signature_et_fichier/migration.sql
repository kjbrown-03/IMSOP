-- AlterEnum
ALTER TYPE "DocumentCategorie" ADD VALUE 'CONSENTEMENT';

-- AlterTable
ALTER TABLE "Consentement" ADD COLUMN     "nomSignataire" TEXT,
ALTER COLUMN "patientId" DROP NOT NULL;
