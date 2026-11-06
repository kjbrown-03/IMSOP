import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle, FileText, Loader2, Upload } from 'lucide-react'
import { api } from '../../lib/api'

// Identique à backend/src/middleware/upload.js.
const TYPES_ACCEPTES = ['application/pdf', 'image/jpeg', 'image/png', 'application/dicom']
const TAILLE_MAX = 25 * 1024 * 1024

/**
 * La demande de complément, là où le patient ou le médecin peut y répondre.
 *
 * Le courriel ne porte plus le texte de la demande, et aucun écran ne permettait
 * de confirmer l'envoi : le dossier restait bloqué sur ce statut sans que personne
 * ne puisse le débloquer, sinon la coordination par un appel direct.
 */
export default function ComplementDemande({ dossier, onRepondu }) {
  const { t } = useTranslation()
  const entree = useRef(null)
  const [reponse, setReponse] = useState('')
  const [fichiers, setFichiers] = useState([])
  const [depot, setDepot] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  async function deposer(e) {
    const choisis = Array.from(e.target.files || [])
    e.target.value = ''
    setErreur(null)
    setDepot(true)
    for (const fichier of choisis) {
      if (!TYPES_ACCEPTES.includes(fichier.type) || fichier.size > TAILLE_MAX) {
        setErreur(t('complement.fichierRefuse', { nom: fichier.name }))
        continue
      }
      try {
        const donnees = new FormData()
        donnees.append('file', fichier)
        donnees.append('category', 'AUTRE')
        await api.post(`/dossiers/${dossier.id}/documents`, donnees)
        setFichiers((liste) => [...liste, fichier.name])
      } catch (err) {
        setErreur(err.response?.data?.message || t('complement.fichierRefuse', { nom: fichier.name }))
      }
    }
    setDepot(false)
  }

  async function envoyer() {
    setEnvoi(true)
    setErreur(null)
    try {
      const texte = reponse.trim()
      const { data } = await api.post(`/dossiers/${dossier.id}/complement-fourni`, texte ? { reponse: texte } : {})
      onRepondu(data)
    } catch (err) {
      setErreur(err.response?.data?.message || t('complement.envoiEchoue'))
    } finally {
      setEnvoi(false)
    }
  }

  // Un bouton qui n'enverrait rien ne s'active pas : le médecin relancerait son
  // analyse en croyant avoir reçu quelque chose.
  const pret = reponse.trim().length > 0 || fichiers.length > 0

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-5 sm:p-6 flex flex-col gap-4 mb-6">
      <h2 className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 shrink-0" /> {t('complement.titre')}
      </h2>
      {dossier.complementPrecisions && (
        <p className="text-sm text-slate-800 dark:text-neutral-100 whitespace-pre-wrap">{dossier.complementPrecisions}</p>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-800 dark:text-neutral-100">
        {t('complement.reponse')}
        <textarea
          rows={3}
          maxLength={4000}
          value={reponse}
          onChange={(e) => setReponse(e.target.value)}
          className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2.5 text-sm font-normal text-slate-900 dark:text-white"
        />
      </label>
      {fichiers.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-slate-700 dark:text-neutral-200">
          {fichiers.map((nom, i) => (
            <li key={`${nom}-${i}`} className="flex items-center gap-2"><FileText className="w-4 h-4 shrink-0" /> {nom}</li>
          ))}
        </ul>
      )}
      {erreur && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{erreur}</p>}
      <div className="flex flex-wrap gap-2">
        <input ref={entree} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.dcm" onChange={deposer} className="sr-only" />
        <button
          type="button"
          onClick={() => entree.current?.click()}
          disabled={depot || envoi}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-neutral-600 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-neutral-100 disabled:opacity-60"
        >
          {depot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {t('complement.joindre')}
        </button>
        <button
          type="button"
          onClick={envoyer}
          disabled={!pret || depot || envoi}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} {t('complement.envoyer')}
        </button>
      </div>
    </section>
  )
}

/** Ce que le praticien retrouve sur sa carte une fois la réponse reçue. */
export function ReponseComplement({ dossier }) {
  const { t } = useTranslation()
  if (!dossier.complementReponse || dossier.status === 'INFORMATION_COMPLEMENTAIRE_DEMANDEE') return null
  return (
    <div className="text-xs text-slate-600 dark:text-neutral-300 rounded-xl bg-slate-50 dark:bg-neutral-800/60 p-3 mt-2 whitespace-pre-wrap">
      <p className="font-bold mb-1">{t('complement.reponseRecue')}</p>
      {dossier.complementReponse}
    </div>
  )
}
