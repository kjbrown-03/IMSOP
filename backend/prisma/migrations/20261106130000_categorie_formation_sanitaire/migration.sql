-- Catégorie de la formation sanitaire déclarée par le médecin candidat.
-- Nullable : les candidatures déjà déposées n'ont jamais eu à la renseigner.
ALTER TABLE "Candidature" ADD COLUMN "categoriePublique" TEXT,
ADD COLUMN "categoriePrivee" TEXT;
