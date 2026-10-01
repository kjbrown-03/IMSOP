-- Sépare le médecin TRAITANT (inscrit seul, désigné par un patient qui le
-- connaît) du médecin PROCHE (proposé par la plateforme dans l'annuaire, contre
-- paiement). Seul le second exige le passage devant le comité scientifique.

-- AlterTable
ALTER TABLE "MedecinLocal" ADD COLUMN     "valideParComite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "valideParComiteLe" TIMESTAMP(3);

-- Les comptes nés d'une candidature ont déjà été examinés par le comité : la
-- candidature qui leur est rattachée en est la preuve. On les marque plutôt que
-- de les renvoyer tous devant le comité.
UPDATE "MedecinLocal" m
SET "valideParComite" = true,
    "valideParComiteLe" = COALESCE(c."compteCreeLe", m."verifiedAt", NOW())
FROM "Candidature" c
WHERE c."compteUserId" = m."userId"
  AND c."statut" = 'COMPTE_CREE';

-- Un médecin déjà visible dans l'annuaire sans être passé par le comité est
-- masqué : il devra déposer une candidature. Mieux vaut le retirer que laisser
-- la plateforme le recommander sans l'avoir examiné.
UPDATE "MedecinLocal"
SET "annuaireVisible" = false
WHERE "annuaireVisible" = true
  AND "valideParComite" = false;
