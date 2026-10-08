-- Médecine conventionnelle ou traditionnelle.
--
-- Les deux coexistent dans la zone, et un patient qui cherche l'une ne cherche
-- pas l'autre : les mélanger dans une même liste de résultats ne rendrait
-- service à personne.
--
-- NOT NULL avec DEFAULT : les comptes et candidatures qui existent déjà
-- basculent tous en CONVENTIONNEL, ce qui est leur nature de fait — la
-- plateforme ne s'adressait qu'à eux jusqu'ici.

-- CreateEnum
CREATE TYPE "TypePratique" AS ENUM ('CONVENTIONNEL', 'TRADITIONNEL');

-- AlterTable
ALTER TABLE "MedecinLocal" ADD COLUMN "typePratique" "TypePratique" NOT NULL DEFAULT 'CONVENTIONNEL';

-- AlterTable
ALTER TABLE "Candidature" ADD COLUMN "typePratique" "TypePratique" NOT NULL DEFAULT 'CONVENTIONNEL';

-- AlterTable
ALTER TABLE "RechercheAnnuaire" ADD COLUMN "typePratique" "TypePratique" NOT NULL DEFAULT 'CONVENTIONNEL';

-- Un patient filtre toujours sur ce champ en même temps que sur la visibilité
-- et l'habilitation : l'index composite évite un parcours complet de la table.
CREATE INDEX "MedecinLocal_typePratique_annuaireVisible_idx"
  ON "MedecinLocal"("typePratique", "annuaireVisible");
