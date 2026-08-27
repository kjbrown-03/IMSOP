// Un dossier n'a pas toujours de compte patient rattache : dans le parcours
// medecin, le praticien decrit un patient anonymise (age, sexe) sans qu'aucun
// compte n'existe - `Dossier.patient` est alors `null`. Afficher directement
// `dossier.patient.user.fullName` faisait planter le rendu et vidait l'ecran.
export function nomPatient(dossier, t) {
  const nom = dossier?.patient?.user?.fullName
  if (nom) return nom

  const details = [
    dossier?.patientAge != null ? t('common.yearsOld', { age: dossier.patientAge }) : null,
    dossier?.patientSexe || null,
  ].filter(Boolean)

  const anonyme = t('common.anonymousPatient')
  return details.length ? `${anonyme} · ${details.join(', ')}` : anonyme
}
