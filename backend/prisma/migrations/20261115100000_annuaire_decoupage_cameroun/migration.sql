-- Région, département et arrondissement : au Cameroun, la ville seule ne
-- situait ni les patients ni les médecins hors des 25 villes de la liste.
-- Colonnes facultatives : les fiches existantes gardent leur ville et restent
-- classées par proximité via leur département.
ALTER TABLE "MedecinLocal" ADD COLUMN "region" TEXT;
ALTER TABLE "MedecinLocal" ADD COLUMN "departement" TEXT;
ALTER TABLE "MedecinLocal" ADD COLUMN "arrondissement" TEXT;

ALTER TABLE "RechercheAnnuaire" ADD COLUMN "region" TEXT;
ALTER TABLE "RechercheAnnuaire" ADD COLUMN "departement" TEXT;
ALTER TABLE "RechercheAnnuaire" ADD COLUMN "arrondissement" TEXT;
