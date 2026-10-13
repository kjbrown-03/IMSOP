-- Le medecin accepte-t-il de nouveaux patients en ce moment ?
--
-- Distinct de annuaireVisible : celui-la dit « je veux figurer dans
-- l'annuaire », celui-ci dit « j'ai de la place ». Vrai par defaut : les
-- medecins deja inscrits ont demande a figurer, donc ils veulent des patients.
-- C'est l'indisponibilite qui est l'exception, et c'est elle qu'on declare.
ALTER TABLE "MedecinLocal" ADD COLUMN "annuaireAccepteNouveaux" BOOLEAN NOT NULL DEFAULT true;
