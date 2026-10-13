/**
 * Corpus d'audit du triage.
 *
 * Chaque entree est une phrase telle qu'un patient la dirait — pas en langage
 * medical — suivie de la specialite qui DOIT apparaitre dans la deduction.
 * medecine_generale est toujours tolere en plus : c'est le filet.
 */
module.exports = [
  // --- cardiologie ---
  ['cardiologie', "j'ai des douleurs thoraciques"],
  ['cardiologie', "j'ai mal dans la poitrine quand je marche"],
  ['cardiologie', "mon coeur bat tres vite le soir"],
  ['cardiologie', "je fais de l'hypertension"],
  ['cardiologie', "ma tension est trop haute"],
  ['cardiologie', "j'ai des palpitations"],
  ['cardiologie', "mes jambes sont gonflees le soir"],
  ['cardiologie', "je suis essouffle quand je monte les escaliers"],
  ['cardiologie', "j'ai fait un infarctus l'annee derniere"],
  ['cardiologie', "le medecin dit que j'ai un souffle au coeur"],

  // --- pneumologie ---
  ['pneumologie', "je tousse depuis trois semaines"],
  ['pneumologie', "j'ai une toux grasse avec des crachats"],
  ['pneumologie', "je siffle quand je respire"],
  ['pneumologie', "j'ai de l'asthme depuis l'enfance"],
  ['pneumologie', "j'ai du mal a respirer la nuit"],
  ['pneumologie', "j'ai une bronchite qui ne passe pas"],
  ['pneumologie', "je crache du sang quand je tousse"],

  // --- gastroenterologie ---
  ['gastroenterologie', "j'ai mal au ventre apres les repas"],
  ['gastroenterologie', "j'ai des brulures d'estomac"],
  ['gastroenterologie', "je vomis tout ce que je mange"],
  ['gastroenterologie', "j'ai la diarrhee depuis une semaine"],
  ['gastroenterologie', "je suis constipe depuis cinq jours"],
  ['gastroenterologie', "mes yeux sont jaunes"],
  ['gastroenterologie', "j'ai des hemorroides qui saignent"],
  ['gastroenterologie', "mon ventre est tout ballonne"],

  // --- dermatologie ---
  ['dermatologie', "j'ai des boutons qui grattent sur les bras"],
  ['dermatologie', "ma peau pele et devient rouge"],
  ['dermatologie', "j'ai des plaques blanches sur le dos"],
  ['dermatologie', "je perds mes cheveux"],
  ['dermatologie', "j'ai une mycose entre les orteils"],
  ['dermatologie', "mes ongles sont abimes et jaunes"],
  ['dermatologie', "j'ai de l'acne sur le visage"],

  // --- orl ---
  ['orl', "j'ai mal a la gorge depuis trois jours"],
  ['orl', "j'ai mal a l'oreille"],
  ['orl', "j'entends mal depuis quelques semaines"],
  ['orl', "j'ai le nez bouche en permanence"],
  ['orl', "j'ai des bourdonnements dans les oreilles"],
  ['orl', "ma voix est enrouee depuis un mois"],
  ['orl', "j'ai une sinusite a repetition"],

  // --- ophtalmologie ---
  ['ophtalmologie', "je vois flou de loin"],
  ['ophtalmologie', "j'ai l'oeil rouge et qui coule"],
  ['ophtalmologie', "ma vue baisse depuis six mois"],
  ['ophtalmologie', "j'ai besoin de lunettes"],
  ['ophtalmologie', "j'ai mal aux yeux devant l'ecran"],

  // --- dentaire ---
  ['dentaire', "j'ai une rage de dent"],
  ['dentaire', "mes gencives saignent quand je brosse"],
  ['dentaire', "j'ai une carie qui fait mal"],
  ['dentaire', "j'ai un abces dentaire"],
  ['dentaire', "ma machoire craque quand je mange"],

  // --- gynecologie ---
  ['gynecologie', "mes regles sont tres douloureuses"],
  ['gynecologie', "je suis enceinte de trois mois"],
  ['gynecologie', "j'ai des pertes blanches inhabituelles"],
  ['gynecologie', "j'ai une boule dans le sein"],
  ['gynecologie', "je n'arrive pas a tomber enceinte"],
  ['gynecologie', "je suis en menopause et j'ai des bouffees de chaleur"],
  ['gynecologie', "je veux une contraception"],

  // --- urologie ---
  ['urologie', "ca brule quand j'urine"],
  ['urologie', "j'urine beaucoup la nuit"],
  ['urologie', "j'ai du sang dans les urines"],
  ['urologie', "j'ai des problemes de prostate"],
  ['urologie', "j'ai des problemes d'erection"],
  ['urologie', "j'ai un calcul renal"],

  // --- nephrologie ---
  ['nephrologie', "j'ai une insuffisance renale"],
  ['nephrologie', "je fais de la dialyse"],
  ['nephrologie', "mes reins ne fonctionnent plus bien"],

  // --- neurologie ---
  ['neurologie', "j'ai des maux de tete tous les jours"],
  ['neurologie', "je fais des migraines"],
  ['neurologie', "j'ai des vertiges quand je me leve"],
  ['neurologie', "mes mains tremblent"],
  ['neurologie', "j'ai des fourmillements dans les jambes"],
  ['neurologie', "je perds la memoire"],
  ['neurologie', "je fais des crises d'epilepsie"],
  ['neurologie', "j'ai fait un avc il y a deux ans"],

  // --- orthopedie ---
  ['orthopedie', "j'ai mal au genou quand je marche"],
  ['orthopedie', "je me suis fait une entorse a la cheville"],
  ['orthopedie', "j'ai mal au dos depuis que je porte des charges"],
  ['orthopedie', "je me suis casse le poignet"],
  ['orthopedie', "j'ai mal a l'epaule quand je leve le bras"],
  ['orthopedie', "ma hanche me fait souffrir"],

  // --- rhumatologie ---
  ['rhumatologie', "j'ai des douleurs articulaires partout"],
  ['rhumatologie', "je suis raide le matin au reveil"],
  ['rhumatologie', "j'ai de l'arthrose aux genoux"],
  ['rhumatologie', "je fais des crises de goutte"],
  ['rhumatologie', "j'ai des rhumatismes"],

  // --- endocrinologie ---
  ['endocrinologie', "je suis diabetique"],
  ['endocrinologie', "j'ai trop de sucre dans le sang"],
  ['endocrinologie', "j'ai des problemes de thyroide"],
  ['endocrinologie', "j'ai beaucoup maigri sans raison"],
  ['endocrinologie', "j'ai toujours soif et j'urine souvent"],
  ['endocrinologie', "j'ai trop de cholesterol"],

  // --- infectiologie ---
  ['infectiologie', "j'ai de la fievre depuis quatre jours"],
  ['infectiologie', "je crois que j'ai le palu"],
  ['infectiologie', "j'ai la typhoide"],
  ['infectiologie', "je suis seropositif"],
  ['infectiologie', "j'ai des frissons et des sueurs la nuit"],
  ['infectiologie', "on m'a diagnostique la tuberculose"],
  ['infectiologie', "j'ai une hepatite b"],

  // --- psychiatrie ---
  ['psychiatrie', "je suis deprime depuis des mois"],
  ['psychiatrie', "je fais des crises d'angoisse"],
  ['psychiatrie', "je n'arrive plus a dormir"],
  ['psychiatrie', "je suis tres stresse au travail"],
  ['psychiatrie', "j'entends des voix"],
  ['psychiatrie', "je bois trop d'alcool"],
  ['psychiatrie', "je n'ai plus le moral"],

  // --- pediatrie ---
  ['pediatrie', "mon enfant a de la fievre"],
  ['pediatrie', "mon bebe pleure tout le temps"],
  ['pediatrie', "ma fille ne grandit pas normalement"],
  ['pediatrie', "mon fils doit faire ses vaccins"],
  ['pediatrie', "mon nourrisson vomit apres chaque tetee"],

  // --- oncologie ---
  ['oncologie', "j'ai une grosseur sous l'aisselle"],
  ['oncologie', "on m'a trouve une tumeur"],
  ['oncologie', "je fais de la chimiotherapie"],
  ['oncologie', "j'ai des ganglions qui ont grossi"],
  ['oncologie', "j'ai un cancer du sein"],

  // --- ligatures francaises ---
  // Les claviers de telephone composent « œ » automatiquement. NFD ne la
  // decompose pas, et tous les motifs sont ecrits en « oe » : « j'ai mal au
  // cœur » ne renvoyait AUCUN cardiologue en production, alors que
  // « j'ai mal au coeur » en trouvait un.
  ['cardiologie', "j'ai mal au cœur"],
  ['cardiologie', "mon cœur bat très fort"],
  ['cardiologie', "j'ai un œdème aux jambes"],
  ['ophtalmologie', "j'ai mal à l'œil"],
  ['gastroenterologie', "j'ai mal à l'œsophage"],

  // --- pathologies nommees ---
  // Beaucoup de patients arrivent avec un diagnostic deja pose, par un medecin
  // ou par l'entourage, et ecrivent le nom de la maladie plutot que ce qu'ils
  // ressentent. Le dictionnaire ne connaissait que les symptomes : 27 pathologies
  // sur 36 tombaient en medecine generale, dont la cataracte, le glaucome,
  // l'appendicite et la meningite.
  ['cardiologie', "j'ai hypertension"],
  ['cardiologie', "j'ai insuffisance cardiaque"],
  ['pneumologie', "j'ai bronchiolite"],
  ['pneumologie', "j'ai pneumonie"],
  ['gastroenterologie', "j'ai ulcere"],
  ['gastroenterologie', "j'ai appendicite"],
  ['gastroenterologie', "j'ai typhoide"],
  ['dermatologie', "j'ai psoriasis"],
  ['dermatologie', "j'ai zona"],
  ['dermatologie', "j'ai gale"],
  ['orl', "j'ai laryngite"],
  ['ophtalmologie', "j'ai glaucome"],
  ['ophtalmologie', "j'ai cataracte"],
  ['dentaire', "j'ai gingivite"],
  ['gynecologie', "j'ai fibrome"],
  ['gynecologie', "j'ai endometriose"],
  ['urologie', "j'ai prostatite"],
  ['urologie', "j'ai cystite"],
  ['nephrologie', "j'ai pyelonephrite"],
  ['neurologie', "j'ai parkinson"],
  ['neurologie', "j'ai alzheimer"],
  ['orthopedie', "j'ai hernie discale"],
  ['orthopedie', "j'ai lombalgie"],
  ['orthopedie', "j'ai scoliose"],
  ['rhumatologie', "j'ai lupus"],
  ['endocrinologie', "j'ai goitre"],
  ['endocrinologie', "j'ai hypothyroidie"],
  ['infectiologie', "j'ai cholera"],
  ['infectiologie', "j'ai bilharziose"],
  ['infectiologie', "j'ai onchocercose"],
  ['infectiologie', "j'ai rougeole"],
  ['psychiatrie', "j'ai schizophrenie"],
  ['psychiatrie', "j'ai trouble bipolaire"],
  ['pediatrie', "j'ai kwashiorkor"],
  ['pediatrie', "j'ai coqueluche"],
  ['oncologie', "j'ai leucemie"],
  ['oncologie', "j'ai lymphome"],
  ['medecine_generale', "j'ai drepanocytose"],
  ['medecine_generale', "j'ai anemie"],

  // --- medecine generale ---
  ['medecine_generale', "je suis fatigue tout le temps"],
  ['medecine_generale', "je veux faire un bilan de sante"],
  ['medecine_generale', "j'ai besoin d'un certificat medical"],
  ['medecine_generale', "je me sens faible"],
]
