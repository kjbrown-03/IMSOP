-- La demande de complément et sa réponse se lisent désormais dans l'espace du
-- patient : elles ne passent plus par le courriel, qui ne porte aucun détail médical.
ALTER TABLE "Dossier" ADD COLUMN "complementPrecisions" TEXT,
ADD COLUMN "complementReponse" TEXT;
