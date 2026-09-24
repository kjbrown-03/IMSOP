-- CreateEnum
CREATE TYPE "TypeStructure" AS ENUM ('CLINIQUE', 'HOPITAL', 'LES_DEUX');

-- AlterTable
ALTER TABLE "Candidature" ADD COLUMN     "emailClinique" TEXT,
ADD COLUMN     "emailHopital" TEXT,
ADD COLUMN     "nomClinique" TEXT,
ADD COLUMN     "nomHopital" TEXT,
ADD COLUMN     "telClinique" TEXT,
ADD COLUMN     "telHopital" TEXT,
ADD COLUMN     "typeStructure" "TypeStructure";

