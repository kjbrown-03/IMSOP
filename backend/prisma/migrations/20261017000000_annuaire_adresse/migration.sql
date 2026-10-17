-- Adresse du cabinet, pour le lien « Voir sur la carte ».
--
-- Texte libre, pas de coordonnees : la position en direct d'un medecin ne
-- regarde personne, et une adresse suffit pour s'y rendre. Donnee au patient
-- apres paiement seulement, comme le telephone.
ALTER TABLE "MedecinLocal" ADD COLUMN "annuaireAdresse" TEXT;
