-- AlterTable
ALTER TABLE "Candidature" ADD COLUMN     "cvKey" TEXT;

-- CreateTable
CREATE TABLE "Specialite" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "pourSpecialiste" BOOLEAN NOT NULL DEFAULT true,
    "pourMedecin" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Specialite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Specialite_nom_key" ON "Specialite"("nom");

-- CreateIndex
CREATE INDEX "Specialite_actif_idx" ON "Specialite"("actif");


-- Les spécialités proposées aujourd'hui en dur dans les écrans, reprises ici
-- pour que les listes ne soient pas vides au premier démarrage. La coordination
-- peut ensuite en ajouter, en retirer ou les réaffecter d'un formulaire à l'autre.
INSERT INTO "Specialite" ("id", "nom", "pourSpecialiste", "pourMedecin", "updatedAt") VALUES
  (gen_random_uuid(), 'Oncologie',               true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Cardiologie',             true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Neurologie',              true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Orthopédie',              true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Radiologie',              true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Anatomopathologie',       true,  false, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Pédiatrie',               true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Gynécologie-obstétrique', true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Néphrologie',             true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Gastro-entérologie',      true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Pneumologie',             true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Médecine générale',       false, true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Médecine interne',        true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Chirurgie générale',      true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Dermatologie',            true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Ophtalmologie',           true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ORL',                     true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Psychiatrie',             true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Urologie',                true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Endocrinologie',          true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Rhumatologie',            true,  true,  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Infectiologie',           true,  true,  CURRENT_TIMESTAMP)
ON CONFLICT ("nom") DO NOTHING;
