-- Annees d'exercice declarees pour l'annuaire.
--
-- Affichees au patient AVANT le paiement : c'est l'un des rares reperes dont
-- dispose quelqu'un qui ne connait personne. Facultatif, donc nullable — un
-- medecin qui ne le renseigne pas n'est pas penalise.
ALTER TABLE "MedecinLocal" ADD COLUMN "annuaireExperience" INTEGER;
