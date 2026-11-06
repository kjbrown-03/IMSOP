-- Avis local, etapes 4 et 5 : un medecin de la zone CEMAC peut etre affecte a un
-- dossier de portee LOCAL, en rediger l'avis et en toucher les honoraires.
--
-- Migration sans perte : elle ajoute des colonnes et relache deux NOT NULL. Tous
-- les rapports et honoraires existants ont un specialiste, donc les contraintes
-- CHECK ci-dessous sont satisfaites d'emblee.
--
-- On n'impose VOLONTAIREMENT pas en base « dossier LOCAL => pas de specialiste » :
-- rien n'empechait jusqu'ici d'affecter un expert a un dossier local. S'il en
-- existe un en production, une telle contrainte ferait echouer le deploiement.
-- La regle est tenue par l'application, a l'affectation.

-- Le redacteur d'un dossier d'avis local.
ALTER TABLE "Dossier" ADD COLUMN "medecinRedacteurId" TEXT;
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_medecinRedacteurId_fkey"
  FOREIGN KEY ("medecinRedacteurId") REFERENCES "MedecinLocal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Dossier_medecinRedacteurId_idx" ON "Dossier"("medecinRedacteurId");

-- Rapport : l'auteur est un specialiste OU un medecin, jamais les deux ni aucun.
ALTER TABLE "Rapport" ALTER COLUMN "specialisteId" DROP NOT NULL;
ALTER TABLE "Rapport" ADD COLUMN "medecinRedacteurId" TEXT;
ALTER TABLE "Rapport" ADD CONSTRAINT "Rapport_medecinRedacteurId_fkey"
  FOREIGN KEY ("medecinRedacteurId") REFERENCES "MedecinLocal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rapport" ADD CONSTRAINT "Rapport_un_seul_auteur"
  CHECK (("specialisteId" IS NOT NULL) <> ("medecinRedacteurId" IS NOT NULL));

-- Honoraire : meme regle pour le beneficiaire.
ALTER TABLE "Honoraire" ALTER COLUMN "specialisteId" DROP NOT NULL;
ALTER TABLE "Honoraire" ADD COLUMN "medecinRedacteurId" TEXT;
ALTER TABLE "Honoraire" ADD CONSTRAINT "Honoraire_medecinRedacteurId_fkey"
  FOREIGN KEY ("medecinRedacteurId") REFERENCES "MedecinLocal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Honoraire_medecinRedacteurId_idx" ON "Honoraire"("medecinRedacteurId");
ALTER TABLE "Honoraire" ADD CONSTRAINT "Honoraire_un_seul_beneficiaire"
  CHECK (("specialisteId" IS NOT NULL) <> ("medecinRedacteurId" IS NOT NULL));

-- Un medecin qui se recuse ne doit plus etre repropose sur ce dossier.
CREATE TABLE "RecusationMedecinLocal" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "medecinLocalId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecusationMedecinLocal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecusationMedecinLocal_dossierId_medecinLocalId_key" ON "RecusationMedecinLocal"("dossierId", "medecinLocalId");
CREATE INDEX "RecusationMedecinLocal_dossierId_idx" ON "RecusationMedecinLocal"("dossierId");
ALTER TABLE "RecusationMedecinLocal" ADD CONSTRAINT "RecusationMedecinLocal_dossierId_fkey"
  FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecusationMedecinLocal" ADD CONSTRAINT "RecusationMedecinLocal_medecinLocalId_fkey"
  FOREIGN KEY ("medecinLocalId") REFERENCES "MedecinLocal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
