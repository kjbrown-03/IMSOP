-- Annees d'exercice declarees par le candidat.
--
-- Lues par le comite scientifique, puis recopiees sur la fiche d'annuaire a la
-- creation du compte : le medecin ne les ressaisit pas.
ALTER TABLE "Candidature" ADD COLUMN "anneesExperience" INTEGER;
