-- Les comptes de pratique traditionnelle, créés jusqu'ici avec le rôle
-- MEDECIN_LOCAL (candidatures et import de la cartographie), passent au rôle
-- TRADIPRATICIEN. Leur profil MedecinLocal ne bouge pas : l'annuaire et les
-- paiements de mise en relation déjà faits y restent rattachés.
UPDATE "User" SET "role" = 'TRADIPRATICIEN'
WHERE "role" = 'MEDECIN_LOCAL'
  AND "id" IN (SELECT "userId" FROM "MedecinLocal" WHERE "typePratique" = 'TRADITIONNEL');

-- Registre des patients du tradipraticien : son carnet de consultation, lu par
-- lui seul. Aucune table existante n'est modifiée.
CREATE TYPE "Sexe" AS ENUM ('MASCULIN', 'FEMININ');
CREATE TYPE "ReferenceVers" AS ENUM ('HOPITAL_CONVENTIONNEL', 'AUTRE_TRADIPRATICIEN');

CREATE TABLE "PatientRegistre" (
    "id" TEXT NOT NULL,
    "medecinLocalId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "sexe" "Sexe" NOT NULL,
    "paysOrigine" TEXT NOT NULL,
    "diagnostic" TEXT NOT NULL,
    "therapeutique" TEXT NOT NULL,
    "dureeTraitement" TEXT NOT NULL,
    "referenceVers" "ReferenceVers",
    "referenceDestinataire" TEXT,
    "referenceMotif" TEXT,
    "referenceLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientRegistre_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientRegistre_medecinLocalId_createdAt_idx" ON "PatientRegistre"("medecinLocalId", "createdAt");

ALTER TABLE "PatientRegistre" ADD CONSTRAINT "PatientRegistre_medecinLocalId_fkey" FOREIGN KEY ("medecinLocalId") REFERENCES "MedecinLocal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
