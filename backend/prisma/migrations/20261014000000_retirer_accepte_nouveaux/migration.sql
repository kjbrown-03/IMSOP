-- Retrait du reglage « j'accepte de nouveaux patients ».
--
-- Il doublonnait avec `annuaireVisible` aux yeux des medecins : les deux
-- libelles disaient en substance la meme chose, et une case que personne ne
-- comprend n'est jamais utilisee correctement. Un medecin complet se retire
-- desormais de l'annuaire et y revient quand il peut.
--
-- Aucune donnee perdue : la colonne ne contenait que sa valeur par defaut.
ALTER TABLE "MedecinLocal" DROP COLUMN "annuaireAccepteNouveaux";
