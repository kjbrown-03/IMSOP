-- Portee d'une demande de deuxieme avis : locale ou internationale.
--
-- INTERNATIONAL par defaut : c'est l'offre d'origine d'IMSOP, et tous les
-- dossiers deja deposes le sont. Aucun dossier existant ne change de nature.
CREATE TYPE "ParcoursAvis" AS ENUM ('LOCAL', 'INTERNATIONAL');

ALTER TABLE "Dossier" ADD COLUMN "portee" "ParcoursAvis" NOT NULL DEFAULT 'INTERNATIONAL';
