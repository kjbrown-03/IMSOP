import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Camera, CheckCircle2, FileText, Loader2, Stethoscope, ShieldCheck, X } from 'lucide-react'
import AuthLayout from '../../components/layout/AuthLayout'
import ListeDeroulante from '../../components/ui/ListeDeroulante'
import { api } from '../../lib/api'
import { OPTIONS_PAYS, villesDe } from '../../lib/cemac'
import { PhotoIllisible, preparerPhoto } from '../../lib/photo'

const CHAMP =
  'w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 font-body-md text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all'

const CHAMPS_STRUCTURE = [
  'typeStructure', 'nomClinique', 'telClinique', 'emailClinique', 'nomHopital', 'telHopital', 'emailHopital',
]

// Plafond sur le fichier d'origine. Large : la photo est réencodée avant
// d'être envoyée, donc ce n'est pas ce poids-là qui part sur le réseau. Il ne
// sert qu'à écarter ce qui n'est manifestement pas un portrait.
const PHOTO_MAX = 25 * 1024 * 1024
const CV_MAX = 10 * 1024 * 1024

/**
 * Formulaire de candidature public, envoyé par le comité scientifique aux
 * praticiens qu'il souhaite recruter. Deux variantes sur la même page :
 * spécialiste international, ou médecin traitant de proximité — les champs
 * diffèrent (pays et ville de la zone CEMAC d'un côté, langues de l'autre).
 *
 * Aucun compte n'existe à ce stade : la page est publique, la photo et le CV
 * partent avec le formulaire, et le candidat reçoit un accusé de réception par
 * e-mail.
 */
export default function Candidature() {
  const { type: typeUrl } = useParams()
  const { t } = useTranslation()

  const estMedecin = typeUrl === 'medecin'
  const type = estMedecin ? 'MEDECIN_LOCAL' : 'SPECIALISTE'

  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', specialite: '',
    etablissement: '', pays: estMedecin ? 'cm' : '', ville: '', langues: '', numeroOrdre: '', presentation: '',
    // Lieu d'exercice du médecin traitant. Vide tant qu'il n'a rien coché :
    // les champs n'apparaissent qu'une fois le type choisi.
    typeStructure: '', nomClinique: '', telClinique: '', emailClinique: '',
    nomHopital: '', telHopital: '', emailHopital: '',
  })
  const [photo, setPhoto] = useState(null)
  const [apercu, setApercu] = useState(null)
  const [cv, setCv] = useState(null)
  const [preparation, setPreparation] = useState(false)
  const [specialites, setSpecialites] = useState([])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [envoyee, setEnvoyee] = useState(false)

  const modifier = (cle) => (e) => setForm((f) => ({ ...f, [cle]: e.target.value }))
  const choisir = (cle) => (valeur) => setForm((f) => ({ ...f, [cle]: valeur }))

  // La liste vient du serveur : la coordination peut l'enrichir sans qu'on
  // redéploie le formulaire.
  useEffect(() => {
    let vivant = true
    api.get('/specialites', { params: { cible: type } })
      .then(({ data }) => { if (vivant) setSpecialites(data.map((s) => s.nom)) })
      .catch(() => { /* la liste reste vide : le champ « Autre » prend le relais */ })
    return () => { vivant = false }
  }, [type])

  // Changer de pays vide la ville : « Douala » n'a pas de sens au Gabon.
  function choisirPays(code) {
    setForm((f) => ({ ...f, pays: code, ville: '' }))
  }

  const villes = useMemo(() => (estMedecin ? villesDe(form.pays) : []), [estMedecin, form.pays])

  const aClinique = form.typeStructure === 'CLINIQUE' || form.typeStructure === 'LES_DEUX'
  const aHopital = form.typeStructure === 'HOPITAL' || form.typeStructure === 'LES_DEUX'

  // Changer de type efface la structure qu'on abandonne : sans ça, un médecin
  // qui coche « clinique » puis se ravise enverrait un nom d'hôpital saisi par
  // erreur, que le serveur refuserait.
  function choisirStructure(valeur) {
    setForm((f) => ({
      ...f,
      typeStructure: valeur,
      ...(valeur === 'HOPITAL' ? { nomClinique: '', telClinique: '', emailClinique: '' } : {}),
      ...(valeur === 'CLINIQUE' ? { nomHopital: '', telHopital: '', emailHopital: '' } : {}),
    }))
  }

  async function choisirPhoto(e) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return

    if (fichier.size > PHOTO_MAX) {
      rejeterPhoto(t('candidature.photoTaille'))
      return
    }

    setErreur(null)
    setPreparation(true)
    try {
      // Le fichier envoyé n'est pas celui que le candidat a choisi : c'est sa
      // version redimensionnée en JPEG. Il n'a donc ni format ni poids à gérer.
      const prete = await preparerPhoto(fichier)
      setPhoto(prete)
      setApercu(URL.createObjectURL(prete))
    } catch (err) {
      rejeterPhoto(err instanceof PhotoIllisible ? t('candidature.photoIllisible') : t('candidature.photoFormat'))
    } finally {
      setPreparation(false)
    }
  }

  // Une photo refusée doit effacer la précédente : laisser l'ancienne vignette
  // en place donne l'impression que le nouveau choix a été pris en compte.
  function rejeterPhoto(message) {
    setPhoto(null)
    setApercu(null)
    setErreur(message)
  }

  function choisirCv(e) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    // Le comité imprime et annote les CV : le PDF est le seul format qui lui
    // arrive tel que le candidat l'a mis en page.
    if (fichier.type !== 'application/pdf') {
      setErreur(t('candidature.cvFormat'))
      return
    }
    if (fichier.size > CV_MAX) {
      setErreur(t('candidature.cvTaille'))
      return
    }
    setErreur(null)
    setCv(fichier)
  }

  // Les listes déroulantes filtrables ne portent pas de `required` natif : le
  // navigateur ne sait pas signaler un champ dont la saisie visible se vide en
  // cours de frappe. On vérifie ici, avec un message explicite.
  function champsManquants() {
    const manquants = []
    if (!form.specialite.trim()) manquants.push(t('candidature.specialite'))
    if (estMedecin && !form.pays) manquants.push(t('candidature.pays'))
    if (estMedecin && !form.ville) manquants.push(t('candidature.ville'))
    if (estMedecin) {
      if (!form.typeStructure) manquants.push(t('candidature.lieuExercice'))
      // Le comité vérifie l'exercice en appelant la structure : sans son nom,
      // il n'a rien à vérifier. Le téléphone, lui, reste facultatif.
      if (aClinique && !form.nomClinique.trim()) manquants.push(t('candidature.nomClinique'))
      if (aHopital && !form.nomHopital.trim()) manquants.push(t('candidature.nomHopital'))
    }
    return manquants
  }

  async function envoyer(e) {
    e.preventDefault()
    if (!photo) {
      setErreur(t('candidature.photoObligatoire'))
      return
    }
    const manquants = champsManquants()
    if (manquants.length) {
      setErreur(t('candidature.champsManquants', { champs: manquants.join(', ') }))
      return
    }
    setEnvoi(true)
    setErreur(null)

    // multipart : les champs vides sont retirés, l'API refuse la chaîne vide.
    const donnees = new FormData()
    donnees.append('type', type)
    donnees.append('photo', photo)
    if (cv) donnees.append('cv', cv)
    for (const [cle, valeur] of Object.entries(form)) {
      // Le serveur refuse un lieu d'exercice sur une candidature de
      // spécialiste : ces champs ne quittent que le formulaire médecin.
      if (!estMedecin && CHAMPS_STRUCTURE.includes(cle)) continue
      // Le code ISO du pays part tel quel : c'est lui que l'annuaire attend.
      // Envoyer « Cameroun » obligeait le praticien à rechoisir son pays dans
      // ses réglages, alors qu'il venait de le renseigner. Le comité, lui, lit
      // le nom — c'est le serveur qui le rend lisible dans son courriel.
      const aEnvoyer = String(valeur)
      if (aEnvoyer.trim() !== '') donnees.append(cle, aEnvoyer.trim())
    }

    try {
      await api.post('/candidatures', donnees)
      setEnvoyee(true)
    } catch (err) {
      const detail = err.response?.data?.errors?.map((x) => `${x.field} : ${x.message}`).join(' — ')
      setErreur(detail || err.response?.data?.message || t('candidature.erreur'))
    } finally {
      setEnvoi(false)
    }
  }

  const titre = estMedecin ? t('candidature.titreMedecin') : t('candidature.titreSpecialiste')

  const libellesListe = {
    autreLabel: t('candidature.specialiteAutre'),
    autreRetourLabel: t('candidature.retourListe'),
    videLabel: t('candidature.aucunResultat'),
  }

  return (
    <AuthLayout
      heading={titre}
      tagline={t('candidature.accroche')}
      badges={
        <>
          <span className="text-on-surface-variant"><Stethoscope className="w-6 h-6 text-primary" /></span>
          <span className="text-on-surface-variant"><ShieldCheck className="w-6 h-6 text-primary" /></span>
        </>
      }
    >
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> {t('common.backHome')}
      </Link>

      {envoyee ? (
        <div className="flex flex-col items-center text-center gap-4 py-10">
          <div className="p-4 rounded-full bg-secondary-container text-on-secondary-container">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary">{t('candidature.merciTitre')}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">{t('candidature.merciTexte')}</p>
        </div>
      ) : (
        <>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-primary mb-2">
            {titre}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mb-6">{t('candidature.consigne')}</p>

          {erreur && (
            <div className="bg-error-container text-on-error-container text-label-sm font-label-sm rounded-lg px-3 py-2 mb-4">
              {erreur}
            </div>
          )}

          <form onSubmit={envoyer} className="flex flex-col gap-4">
            {/* La photo en premier : c'est ce que le comité voit d'abord, et
                l'oublier en bas d'un long formulaire arrive trop souvent. */}
            <div className="flex items-center gap-4">
              <label className="relative shrink-0 w-24 h-24 rounded-2xl bg-surface-container-low border-2 border-dashed border-outline-variant hover:border-primary cursor-pointer overflow-hidden flex items-center justify-center transition-colors">
                {preparation ? (
                  <Loader2 className="w-7 h-7 text-primary animate-spin" />
                ) : apercu ? (
                  <img src={apercu} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-on-surface-variant" />
                )}
                <input type="file" accept="image/*" onChange={choisirPhoto} className="sr-only" />
              </label>
              <div className="text-sm">
                <p className="font-label-md text-label-md text-on-surface">
                  {t('candidature.photo')} <span className="text-error">*</span>
                </p>
                <p className="text-on-surface-variant text-xs mt-1">{t('candidature.photoAide')}</p>
              </div>
            </div>

            <Champ label={t('candidature.fullName')} obligatoire>
              <input required className={CHAMP} value={form.fullName} onChange={modifier('fullName')} autoComplete="name" />
            </Champ>
            <Champ label={t('candidature.email')} obligatoire>
              <input required type="email" className={CHAMP} value={form.email} onChange={modifier('email')} autoComplete="email" />
            </Champ>
            <Champ label={t('candidature.phone')}>
              <input type="tel" className={CHAMP} value={form.phone} onChange={modifier('phone')} autoComplete="tel" />
            </Champ>

            {/* Le spécialiste reste sur une liste fermée : c'est elle que le
                moteur d'affectation compare aux demandes des patients. Le
                médecin traitant, lui, n'est jamais affecté — sa spécialité est
                indicative, une saisie libre ne casse rien. */}
            <Champ label={t('candidature.specialite')} obligatoire liste>
              <ListeDeroulante
                value={form.specialite}
                onChange={choisir('specialite')}
                options={specialites}
                placeholder={t('candidature.specialiteChoisir')}
                autreAutorise={estMedecin}
                autrePlaceholder={t('candidature.specialiteAutrePlaceholder')}
                {...libellesListe}
              />
            </Champ>

            {!estMedecin && (
              <Champ label={t('candidature.etablissement')}>
                <input className={CHAMP} value={form.etablissement} onChange={modifier('etablissement')} />
              </Champ>
            )}

            {estMedecin ? (
              <>
                {/* Le médecin traitant exerce dans la zone CEMAC : liste fermée
                    de pays, et les villes suivent celui qu'il choisit. */}
                <Champ label={t('candidature.pays')} obligatoire liste>
                  <ListeDeroulante
                    value={form.pays}
                    onChange={choisirPays}
                    options={OPTIONS_PAYS.map((p) => ({ valeur: p.code, label: p.nom }))}
                    placeholder={t('candidature.paysChoisir')}
                    videLabel={t('candidature.aucunResultat')}
                  />
                </Champ>
                <Champ label={t('candidature.ville')} obligatoire liste>
                  <ListeDeroulante
                    value={form.ville}
                    onChange={choisir('ville')}
                    options={villes}
                    placeholder={form.pays ? t('candidature.villeChoisir') : t('candidature.villePaysDabord')}
                    disabled={!form.pays}
                    videLabel={t('candidature.aucunResultat')}
                  />
                </Champ>
                {/* Lieu d'exercice : le comité appelle la structure pour
                    vérifier que le médecin y exerce réellement. Les champs
                    n'apparaissent qu'une fois le type choisi — afficher les six
                    d'emblée donnerait un formulaire deux fois plus long dont la
                    moitié ne le concerne pas. */}
                <fieldset className="flex flex-col gap-3">
                  <legend className="font-label-md text-label-md text-on-surface mb-2">
                    {t('candidature.lieuExercice')} <span className="text-error">*</span>
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {['CLINIQUE', 'HOPITAL', 'LES_DEUX'].map((valeur) => (
                      <OptionStructure
                        key={valeur}
                        valeur={valeur}
                        choisi={form.typeStructure === valeur}
                        onChange={choisirStructure}
                        label={t(`candidature.structure.${valeur}`)}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-on-surface-variant">{t('candidature.lieuExerciceAide')}</p>
                </fieldset>

                {aClinique && (
                  <GroupeStructure titre={t('candidature.blocClinique')}>
                    <Champ label={t('candidature.nomClinique')} obligatoire>
                      <input required className={CHAMP} value={form.nomClinique} onChange={modifier('nomClinique')} />
                    </Champ>
                    <Champ label={t('candidature.telStructure')}>
                      <input type="tel" className={CHAMP} value={form.telClinique} onChange={modifier('telClinique')} />
                    </Champ>
                    <Champ label={t('candidature.emailStructure')}>
                      <input type="email" className={CHAMP} value={form.emailClinique} onChange={modifier('emailClinique')} />
                    </Champ>
                  </GroupeStructure>
                )}

                {aHopital && (
                  <GroupeStructure titre={t('candidature.blocHopital')}>
                    <Champ label={t('candidature.nomHopital')} obligatoire>
                      <input required className={CHAMP} value={form.nomHopital} onChange={modifier('nomHopital')} />
                    </Champ>
                    <Champ label={t('candidature.telStructure')}>
                      <input type="tel" className={CHAMP} value={form.telHopital} onChange={modifier('telHopital')} />
                    </Champ>
                    <Champ label={t('candidature.emailStructure')}>
                      <input type="email" className={CHAMP} value={form.emailHopital} onChange={modifier('emailHopital')} />
                    </Champ>
                  </GroupeStructure>
                )}

                <Champ label={t('candidature.numeroOrdre')}>
                  <input className={CHAMP} value={form.numeroOrdre} onChange={modifier('numeroOrdre')} />
                </Champ>
              </>
            ) : (
              <>
                <Champ label={t('candidature.pays')}>
                  <input className={CHAMP} value={form.pays} onChange={modifier('pays')} autoComplete="country-name" />
                </Champ>
                <Champ label={t('candidature.langues')}>
                  <input className={CHAMP} value={form.langues} onChange={modifier('langues')} placeholder="FR, EN" />
                </Champ>
              </>
            )}

            <Champ label={t('candidature.cv')} aide={t('candidature.cvAide')} liste>
              {cv ? (
                <div className="flex items-center gap-3 bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <span className="font-body-md text-body-md text-on-surface truncate flex-1">{cv.name}</span>
                  <button
                    type="button"
                    onClick={() => setCv(null)}
                    aria-label={t('candidature.cvRetirer')}
                    className="text-on-surface-variant hover:text-error transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-3 bg-surface-container-low border-2 border-dashed border-outline-variant hover:border-primary rounded-xl px-4 py-3 cursor-pointer transition-colors">
                  <FileText className="w-5 h-5 text-on-surface-variant shrink-0" />
                  <span className="font-body-md text-body-md text-on-surface-variant">{t('candidature.cvChoisir')}</span>
                  <input type="file" accept="application/pdf" onChange={choisirCv} className="sr-only" />
                </label>
              )}
            </Champ>

            <Champ label={t('candidature.presentation')} obligatoire aide={t('candidature.presentationAide')}>
              <textarea required minLength={50} rows={6} className={`${CHAMP} resize-y`} value={form.presentation} onChange={modifier('presentation')} />
            </Champ>

            <button
              type="submit"
              disabled={envoi || preparation}
              className="mt-2 bg-primary text-on-primary font-label-md text-label-md rounded-xl py-3.5 hover:bg-primary-container hover:text-on-primary-container transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('candidature.envoyer')}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}

/**
 * Un bouton radio présenté comme une carte : la cible est assez grande pour le
 * pouce, ce qu'un rond de 16 px n'est pas. Le vrai <input type="radio"> reste
 * là, masqué visuellement mais bien présent pour le clavier et les lecteurs
 * d'écran, qui annoncent ainsi « 1 sur 3 ».
 */
function OptionStructure({ valeur, choisi, onChange, label }) {
  return (
    <label
      className={`flex items-center gap-2 rounded-xl border px-3 py-3 cursor-pointer transition-colors ${
        choisi
          ? 'border-primary bg-primary/10 text-on-surface'
          : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-primary'
      }`}
    >
      <input
        type="radio"
        name="typeStructure"
        value={valeur}
        checked={choisi}
        onChange={() => onChange(valeur)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
          choisi ? 'border-primary' : 'border-outline-variant'
        }`}
      >
        {choisi && <span className="w-2 h-2 rounded-full bg-primary" />}
      </span>
      <span className="font-label-md text-label-md whitespace-nowrap">{label}</span>
    </label>
  )
}

function GroupeStructure({ titre, children }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-outline-variant bg-surface-container-low/50 p-4">
      <p className="font-label-md text-label-md text-primary">{titre}</p>
      {children}
    </div>
  )
}

/**
 * `liste` rend l'enveloppe en <div> plutôt qu'en <label> : une liste déroulante
 * filtrable contient des boutons, et un clic sur un bouton à l'intérieur d'un
 * <label> renvoie le focus au champ de saisie au lieu de valider le choix.
 */
function Champ({ label, obligatoire, aide, liste, children }) {
  const Enveloppe = liste ? 'div' : 'label'
  return (
    <Enveloppe className="flex flex-col gap-1.5">
      <span className="font-label-md text-label-md text-on-surface">
        {label}
        {obligatoire && <span className="text-error"> *</span>}
      </span>
      {children}
      {aide && <span className="text-xs text-on-surface-variant">{aide}</span>}
    </Enveloppe>
  )
}
