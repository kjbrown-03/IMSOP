-- Le pays où vit le patient, distinct de celui où il cherche un praticien
-- (`pays`) : un patient du Gabon peut consulter au Cameroun.
ALTER TABLE "RechercheAnnuaire" ADD COLUMN "paysResidence" TEXT;
