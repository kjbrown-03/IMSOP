-- CDC §16 : l'habilitation d'un professionnel a un cycle de vie
-- (EN VÉRIFICATION → VALIDÉ → SUSPENDU → EXPIRÉ → RÉVOQUÉ), qu'un booléen
-- ne peut pas porter.
CREATE TYPE "VerificationStatus" AS ENUM ('EN_VERIFICATION', 'VALIDE', 'SUSPENDU', 'EXPIRE', 'REVOQUE');

-- Justificatifs exigés au §16 avant activation d'un compte professionnel.
CREATE TYPE "ProfessionalDocumentType" AS ENUM ('DIPLOME', 'LICENCE', 'INSCRIPTION_ORDRE', 'PIECE_IDENTITE', 'CV', 'REFERENCES', 'AUTRE');

-- CDC §30 : cinquième consentement, l'usage anonymisé à des fins de recherche.
ALTER TYPE "ConsentementType" ADD VALUE 'UTILISATION_ANONYMISEE_RECHERCHE';

-- CDC §53 : les quatre statuts manquants.
ALTER TYPE "DossierStatus" ADD VALUE 'EN_ATTENTE_DOCUMENTS';
ALTER TYPE "DossierStatus" ADD VALUE 'ACCEPTE_PAR_SPECIALISTE';
ALTER TYPE "DossierStatus" ADD VALUE 'INFORMATION_COMPLEMENTAIRE_DEMANDEE';
ALTER TYPE "DossierStatus" ADD VALUE 'SUIVI';

-- Les colonnes sont ajoutées AVANT la suppression de "verified" pour pouvoir
-- reporter l'état existant : un profil déjà vérifié reste vérifié.
ALTER TABLE "MedecinLocal"
  ADD COLUMN "habilitationExpireLe" TIMESTAMP(3),
  ADD COLUMN "verificationMotif" TEXT,
  ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'EN_VERIFICATION',
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedById" TEXT;

ALTER TABLE "Specialiste"
  ADD COLUMN "habilitationExpireLe" TIMESTAMP(3),
  ADD COLUMN "verificationMotif" TEXT,
  ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'EN_VERIFICATION',
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedById" TEXT;

UPDATE "MedecinLocal" SET "verificationStatus" = 'VALIDE', "verifiedAt" = CURRENT_TIMESTAMP WHERE "verified" = true;
UPDATE "Specialiste"  SET "verificationStatus" = 'VALIDE', "verifiedAt" = CURRENT_TIMESTAMP WHERE "verified" = true;

ALTER TABLE "MedecinLocal" DROP COLUMN "verified";
ALTER TABLE "Specialiste"  DROP COLUMN "verified";

CREATE TABLE "ProfessionalDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ProfessionalDocumentType" NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalDocument_pkey" PRIMARY KEY ("id")
);

-- CDC §11 : le numéro de dossier devient un compteur. Le tirage aléatoire sur
-- 9 000 valeurs entrait en collision avec la contrainte d'unicité vers le
-- ~113e dossier d'une même année.
CREATE TABLE "SequenceCompteur" (
    "cle" TEXT NOT NULL,
    "valeur" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SequenceCompteur_pkey" PRIMARY KEY ("cle")
);

CREATE INDEX "ProfessionalDocument_userId_idx" ON "ProfessionalDocument"("userId");

ALTER TABLE "ProfessionalDocument" ADD CONSTRAINT "ProfessionalDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
