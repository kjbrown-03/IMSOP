-- Une mise en relation payée donne UN contact. Avant, le paiement envoyait
-- au navigateur les coordonnées de tous les praticiens de la recherche, jusqu'à
-- ce que le patient en choisisse un : il pouvait tous les lire pour le prix
-- d'un seul.
ALTER TABLE "RechercheAnnuaire" ADD COLUMN "contactsPayes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RechercheAnnuaire" ADD COLUMN "contactsChoisis" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Recherches déjà payées : chacun garde ce qu'il a acheté sous l'ancienne
-- règle. Un choix fait = ce contact ; pas de choix = tous les contacts, qu'il
-- voyait déjà.
UPDATE "RechercheAnnuaire"
SET "contactsPayes" = 1, "contactsChoisis" = ARRAY["specialisteChoisiId"]
WHERE "statut" = 'DEBLOQUEE' AND "specialisteChoisiId" IS NOT NULL;

UPDATE "RechercheAnnuaire" r
SET "contactsChoisis" = COALESCE((SELECT array_agg(x."id") FROM "RechercheAnnuaireResultat" x WHERE x."rechercheId" = r."id"), ARRAY[]::TEXT[]),
    "contactsPayes" = (SELECT count(*) FROM "RechercheAnnuaireResultat" x WHERE x."rechercheId" = r."id")
WHERE r."statut" = 'DEBLOQUEE' AND r."specialisteChoisiId" IS NULL;
