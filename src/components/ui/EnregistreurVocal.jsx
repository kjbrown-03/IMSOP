import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Mic, Square } from 'lucide-react'
import { api } from '../../lib/api'

/**
 * Dire son mal plutôt que l'écrire.
 *
 * POUR QUI
 *
 * Quelqu'un qui ne sait pas écrire, qui a mal au point de ne pas pouvoir taper,
 * qui a la main blessée, ou qui se débat avec un clavier de téléphone. Le texte
 * reste la voie principale : ceci s'ajoute à côté, il ne remplace rien.
 *
 * CE QUI SE PASSE ENSUITE
 *
 * L'enregistrement part au serveur, qui le transcrit lui-même — il ne quitte
 * jamais la machine — et renvoie le texte. Celui-ci est DÉPOSÉ DANS LE CHAMP, où
 * il reste modifiable. C'est délibéré : la transcription est excellente mais pas
 * infaillible, et personne ne doit lancer une recherche médicale sur des mots
 * qu'il n'a pas relus.
 *
 * L'audio n'est conservé nulle part, ni ici ni sur le serveur.
 */

// Au-delà, on arrête tout seul. Une description de symptômes tient largement en
// une minute, et laisser courir un enregistrement oublié ferait monter un
// fichier inutile sur une connexion mobile.
const DUREE_MAX_S = 60

// Par ordre de préférence. Chrome et Android donnent WebM/Opus, Safari et iOS
// MP4/AAC, Firefox Ogg. On ne force rien : on prend le premier que le navigateur
// déclare savoir produire, et le serveur accepte les trois familles.
const FORMATS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

function formatSupporte() {
  if (typeof MediaRecorder === 'undefined') return null
  return FORMATS.find((f) => MediaRecorder.isTypeSupported?.(f)) ?? ''
}

export default function EnregistreurVocal({ onTexte, langue, desactive }) {
  const { t } = useTranslation()
  const [etat, setEtat] = useState('pret') // pret | enregistre | envoi
  const [secondes, setSecondes] = useState(0)
  const [erreur, setErreur] = useState(null)

  const recorderRef = useRef(null)
  const morceauxRef = useRef([])
  const minuteurRef = useRef(null)

  // Couper le micro quoi qu'il arrive : sans ça, le voyant de l'appareil reste
  // allumé après un changement de page, ce qui est au mieux inquiétant.
  const libererMicro = () => {
    const flux = recorderRef.current?.stream
    flux?.getTracks().forEach((piste) => piste.stop())
    recorderRef.current = null
    clearInterval(minuteurRef.current)
    minuteurRef.current = null
  }

  useEffect(() => libererMicro, [])

  const disponible = typeof navigator !== 'undefined' && navigator.mediaDevices && formatSupporte() !== null

  async function demarrer() {
    setErreur(null)
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true })
      const type = formatSupporte()
      const recorder = new MediaRecorder(flux, type ? { mimeType: type } : undefined)

      morceauxRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) morceauxRef.current.push(e.data)
      }
      recorder.onstop = () => envoyer(recorder.mimeType)

      recorderRef.current = recorder
      recorder.start()
      setEtat('enregistre')
      setSecondes(0)

      minuteurRef.current = setInterval(() => {
        setSecondes((n) => {
          if (n + 1 >= DUREE_MAX_S) arreter()
          return n + 1
        })
      }, 1000)
    } catch (err) {
      // Un refus de permission n'est pas une panne : c'est un choix, et le champ
      // texte reste là. On le dit sans dramatiser.
      const refus = err?.name === 'NotAllowedError' || err?.name === 'SecurityError'
      setErreur(t(refus ? 'vocal.permissionRefusee' : 'vocal.microIndisponible'))
      setEtat('pret')
      libererMicro()
    }
  }

  function arreter() {
    clearInterval(minuteurRef.current)
    minuteurRef.current = null
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  async function envoyer(typeMime) {
    const morceaux = morceauxRef.current
    morceauxRef.current = []
    libererMicro()

    if (!morceaux.length) {
      setEtat('pret')
      return
    }

    setEtat('envoi')
    try {
      const blob = new Blob(morceaux, { type: typeMime || 'audio/webm' })
      const donnees = new FormData()
      // L'extension suit le type : le moteur de transcription s'en sert pour
      // choisir son décodeur.
      const extension = (typeMime || '').includes('mp4') ? 'm4a' : (typeMime || '').includes('ogg') ? 'ogg' : 'webm'
      donnees.append('audio', blob, `description.${extension}`)
      if (langue) donnees.append('langue', langue)

      const { data } = await api.post('/api/annuaire/transcription', donnees)
      if (data?.texte) onTexte(data.texte)
      else setErreur(t('vocal.rienCompris'))
    } catch (err) {
      const statut = err?.response?.status
      setErreur(
        statut === 503
          ? t('vocal.occupe')
          : err?.response?.data?.message || t('vocal.echec'),
      )
    } finally {
      setEtat('pret')
      setSecondes(0)
    }
  }

  // Navigateur sans micro ou trop ancien : on n'affiche rien plutôt qu'un bouton
  // qui échouerait. Le champ texte suffit.
  if (!disponible) return null

  const minutes = String(Math.floor(secondes / 60)).padStart(2, '0')
  const reste = String(secondes % 60).padStart(2, '0')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={etat === 'enregistre' ? arreter : demarrer}
          disabled={desactive || etat === 'envoi'}
          aria-label={t(etat === 'enregistre' ? 'vocal.arreter' : 'vocal.demarrer')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-label-md text-label-md transition-colors disabled:opacity-50 ${
            etat === 'enregistre'
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-main)] hover:border-[var(--color-primary)]'
          }`}
        >
          {etat === 'envoi' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : etat === 'enregistre' ? (
            <Square className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
          {t(
            etat === 'envoi'
              ? 'vocal.transcription'
              : etat === 'enregistre'
                ? 'vocal.arreter'
                : 'vocal.demarrer',
          )}
        </button>

        {etat === 'enregistre' && (
          <span className="flex items-center gap-2 font-body-sm text-body-sm text-[var(--color-text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" aria-hidden="true" />
            {minutes}:{reste} / 01:00
          </span>
        )}
      </div>

      {/* aria-live : l'issue de l'enregistrement doit être annoncée, puisqu'elle
          se manifeste ailleurs — dans le champ de texte. */}
      <p className="font-body-sm text-body-sm text-[var(--color-text-secondary)]" aria-live="polite">
        {erreur ? <span className="text-red-600 dark:text-red-400">{erreur}</span> : t('vocal.aide')}
      </p>
    </div>
  )
}
