-- Le medecin accepte-t-il de rediger des avis ecrits sur dossier ?
--
-- Distinct de `annuaireVisible` : figurer dans l'annuaire, c'est accepter une
-- consultation ; rediger un avis, c'est etudier un dossier a distance et
-- engager sa signature. Beaucoup accepteront le premier sans vouloir du second.
--
-- Faux par defaut : on ne presume pas qu'un medecin veut ce travail.
ALTER TABLE "MedecinLocal" ADD COLUMN "avisLocalActif" BOOLEAN NOT NULL DEFAULT false;
