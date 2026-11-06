---
name: imsop-description-vocale
description: Description vocale des symptomes sur IMSOP — transcription locale faster-whisper, garde-fous CPU, verifiee en production
metadata:
  type: project
---

Ajoutee le 2026-10-12. Un patient peut décrire son mal à la voix au lieu de
l'écrire, dans le formulaire « Médecin spécialiste le plus proche ».

**La moitié du travail existait déjà** : `backend/src/lib/triage.js` transforme
une description écrite en spécialités. La seule brique nouvelle est « audio →
texte » ; tout le reste du parcours fonctionne sans y toucher. Vérifier cette
brique sur la machine AVANT d'écrire du code a été la bonne décision.

**Transcription locale, par choix explicite de l'utilisateur** (interrogé le
2026-10-12) : service `transcription` dans `deploy/docker-compose.prod.yml`,
image `onerahmet/openai-whisper-asr-webservice`, moteur `faster_whisper`, modèle
`small`, aucun port publié. Un enregistrement où quelqu'un décrit sa maladie est
une donnée de santé — la garder sur la machine évite de la confier à un tiers.
L'audio n'est jamais écrit sur disque (multer en mémoire) et est effacé aussitôt.

**Mesures réelles sur le VPS (2 cœurs) :** ~3,2 s pour 11 s d'audio en interne,
4,2 s de bout en bout par HTTPS. La transcription française est ressortie mot
pour mot, accents et « œ » compris.

**Trois garde-fous, tous pour la même raison — 2 cœurs partagés avec l'app :**
1. verrou de concurrence dans `transcriptionService.js` (1 à la fois, 503 au-delà) ;
2. `cpus: 1.5` sur le conteneur, pour qu'il reste de quoi servir les pages ;
3. `transcriptionLimiter` : 6 par 15 min et par IP.
Les trois ont été testés en production : non-audio → 400, deux simultanées →
une 200 + une 503.

**Why:** c'est le seul point d'entrée public qui occupe un cœur entier pendant
plusieurs secondes. Sans ces limites, quelques enregistrements simultanés — ou un
seul visiteur qui boucle — rendraient tout le site injoignable, alors que la
recherche vocale n'est qu'un confort.

**How to apply:** le texte transcrit est DÉPOSÉ dans le champ et reste
modifiable, et il complète ce qui s'y trouvait au lieu de l'écraser — ne pas
« simplifier » ça. Les enregistrements vocaux sont déclarés dans la politique de
confidentialité (`legal.confidentialite.s2.liste`). Si un jour on veut servir
des langues locales (ewondo, douala, fulfulde, pidgin), faster-whisper ne les
couvre pas : il faudrait transmettre l'audio à la coordination qui écoute, et
donc revoir la décision de ne rien conserver. Voir
[[imsop-annuaire-mise-en-relation]] et [[imsop-turn-server-production]].

**Modèles comparés sur la machine de production (2026-10-12), 11 s d'audio français :**

| Modèle | Durée | Mémoire |
|---|---|---|
| `small` (en service) | 3,2 s | 1,1 Go |
| `medium` | 8,8 s | 2,2 Go |
| `large-v3-turbo` | 9,8 s | 1,9 Go |

`medium` est à écarter : `large-v3-turbo` rend la qualité du grand modèle pour un
temps comparable et moins de mémoire. Le choix réel est `small` contre `turbo`.
Attention : ces mesures sont sans la limite `cpus: 1.5` du compose de production,
donc `turbo` y serait plus lent, et `mem_limit: 2g` serait à relever.

**Deux réglages qui améliorent la qualité sans coûter de temps :**
- `initial_prompt` avec du vocabulaire médical (AMORCE_MEDICALE dans
  transcriptionService.js) — oriente le décodage, n'apparaît jamais dans le texte rendu.
- Captation : `echoCancellation`, `noiseSuppression`, `autoGainControl`, mono 16 kHz
  dans getUserMedia. `audio: true` seul donnait un signal faible et bruité.

**Hallucinations :** sans `vad_filter=true`, le silence produisait du texte inventé
(« You », « Sous-titres réalisés par la communauté d'Amara.org »). Filtre VAD +
liste de phrases connues + durée minimale d'1 s côté navigateur.
