import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FileUp, Loader2, Send, Trash2 } from 'lucide-react'
import MedecinShell from '../../components/layout/MedecinShell'
import { api } from '../../lib/api'

const SEXES = ['femme', 'homme', 'autre']
const TYPES_ACCEPTES = 'application/pdf,image/jpeg,image/png,application/dicom'
const CHAMP =
  'w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white'

const CHAMPS_INITIAUX = {
  specialiteRequise: '',
  patientAge: '',
  patientSexe: 'femme',
  motif: '',
  question: '',
  symptomes: '',
  antecedents: '',
  traitementEnCours: '',
}

function Champ({ label, optionnel, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">
        {label}
        {optionnel && <span className="ml-1.5 font-normal text-slate-400">({optionnel})</span>}
      </span>
      {children}
    </label>
  )
}

/**
 * Demande de second avis ouverte par le médecin traitant lui-même, quand un cas
 * lui laisse un doute sur son propre diagnostic.
 *
 * Le patient n'est jamais nommé : seuls l'âge et le sexe sont demandés, ce qui
 * suffit au spécialiste pour interpréter le cas sans transmettre la moindre
 * donnée identifiante. La demande part ensuite à la coordination, qui l'affecte.
 */
export default function NouvelleDemandeMedecin() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const inputFichier = useRef(null)

  const [champs, setChamps] = useState(CHAMPS_INITIAUX)
  const [fichiers, setFichiers] = useState([])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  const modifier = (nom) => (e) => setChamps((c) => ({ ...c, [nom]: e.target.value }))

  function ajouterFichiers(e) {
    const choisis = Array.from(e.target.files || [])
    e.target.value = ''
    setFichiers((precedents) => [...precedents, ...choisis])
  }

  const complet =
    champs.specialiteRequise.trim() &&
    champs.patientAge !== '' &&
    champs.motif.trim() &&
    champs.question.trim()

  async function envoyer(e) {
    e.preventDefault()
    if (!complet || envoi) return
    setErreur(null)
    setEnvoi(true)

    try {
      // Trois temps : la demande, puis ses pièces, puis la transmission. Les
      // pièces doivent être attachées avant que la coordination ne la reçoive.
      const { data: dossier } = await api.post('/dossiers/demande-medecin', {
        specialiteRequise: champs.specialiteRequise.trim(),
        patientAge: Number(champs.patientAge),
        patientSexe: champs.patientSexe,
        motif: champs.motif.trim(),
        question: champs.question.trim(),
        symptomes: champs.symptomes.trim() || undefined,
        antecedents: champs.antecedents.trim() || undefined,
        traitementEnCours: champs.traitementEnCours.trim() || undefined,
      })

      for (const fichier of fichiers) {
        const formData = new FormData()
        formData.append('file', fichier)
        formData.append('type', 'AUTRE')
        await api.post('/dossiers/' + dossier.id + '/documents', formData)
      }

      await api.post('/dossiers/' + dossier.id + '/transmettre')
      navigate('/medecin/dossiers')
    } catch (err) {
      setErreur(err.response?.data?.message || t('medecin.nouvelleDemande.erreur'))
      setEnvoi(false)
    }
  }

  return (
    <MedecinShell>
      <form onSubmit={envoyer} className="flex flex-col gap-6 max-w-3xl">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t('medecin.nouvelleDemande.titre')}
          </h1>
          <p className="text-slate-500 dark:text-neutral-400 text-sm">
            {t('medecin.nouvelleDemande.sousTitre')}
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 flex flex-col gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
            {t('medecin.nouvelleDemande.sectionPatient')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            {t('medecin.nouvelleDemande.noteAnonymat')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Champ label={t('medecin.nouvelleDemande.age')}>
              <input
                type="number"
                min="0"
                max="120"
                required
                value={champs.patientAge}
                onChange={modifier('patientAge')}
                className={CHAMP}
              />
            </Champ>
            <Champ label={t('medecin.nouvelleDemande.sexe')}>
              <select value={champs.patientSexe} onChange={modifier('patientSexe')} className={CHAMP}>
                {SEXES.map((sexe) => (
                  <option key={sexe} value={sexe} className="text-slate-900">
                    {t('medecin.nouvelleDemande.sexes.' + sexe)}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ label={t('medecin.nouvelleDemande.specialite')}>
              <input
                type="text"
                required
                placeholder={t('medecin.nouvelleDemande.specialitePlaceholder')}
                value={champs.specialiteRequise}
                onChange={modifier('specialiteRequise')}
                className={CHAMP}
              />
            </Champ>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 flex flex-col gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
            {t('medecin.nouvelleDemande.sectionCas')}
          </h2>
          <Champ label={t('medecin.nouvelleDemande.motif')}>
            <textarea
              required
              rows={3}
              value={champs.motif}
              onChange={modifier('motif')}
              placeholder={t('medecin.nouvelleDemande.motifPlaceholder')}
              className={CHAMP + ' resize-y'}
            />
          </Champ>
          <Champ label={t('medecin.nouvelleDemande.symptomes')} optionnel={t('medecin.nouvelleDemande.optionnel')}>
            <textarea rows={2} value={champs.symptomes} onChange={modifier('symptomes')} className={CHAMP + ' resize-y'} />
          </Champ>
          <Champ label={t('medecin.nouvelleDemande.antecedents')} optionnel={t('medecin.nouvelleDemande.optionnel')}>
            <textarea rows={2} value={champs.antecedents} onChange={modifier('antecedents')} className={CHAMP + ' resize-y'} />
          </Champ>
          <Champ label={t('medecin.nouvelleDemande.traitement')} optionnel={t('medecin.nouvelleDemande.optionnel')}>
            <textarea
              rows={2}
              value={champs.traitementEnCours}
              onChange={modifier('traitementEnCours')}
              className={CHAMP + ' resize-y'}
            />
          </Champ>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
            {t('medecin.nouvelleDemande.sectionDocuments')}
          </h2>
          <input
            ref={inputFichier}
            type="file"
            multiple
            accept={TYPES_ACCEPTES}
            onChange={ajouterFichiers}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputFichier.current?.click()}
            className="self-start flex items-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-neutral-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <FileUp className="w-4 h-4" />
            {t('medecin.nouvelleDemande.ajouterDocuments')}
          </button>
          {fichiers.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {fichiers.map((fichier, index) => (
                <li
                  key={fichier.name + index}
                  className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-neutral-200 bg-slate-50 dark:bg-neutral-800 rounded-lg px-3 py-2"
                >
                  <span className="truncate">{fichier.name}</span>
                  <button
                    type="button"
                    aria-label={t('medecin.nouvelleDemande.retirerDocument')}
                    onClick={() => setFichiers((liste) => liste.filter((_, i) => i !== index))}
                    className="text-slate-400 hover:text-rose-600 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border-2 border-[var(--color-primary)] bg-white dark:bg-neutral-900 p-5 flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-primary)]">
            {t('medecin.nouvelleDemande.sectionQuestion')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            {t('medecin.nouvelleDemande.noteQuestionUnique')}
          </p>
          <textarea
            required
            rows={3}
            value={champs.question}
            onChange={modifier('question')}
            placeholder={t('medecin.nouvelleDemande.questionPlaceholder')}
            className={CHAMP + ' resize-y'}
          />
        </section>

        {erreur && <p className="text-sm font-semibold text-rose-600">{erreur}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!complet || envoi}
            className="flex items-center gap-2 rounded-full bg-[var(--color-primary)] text-white px-6 py-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {envoi ? t('medecin.nouvelleDemande.envoiEnCours') : t('medecin.nouvelleDemande.envoyer')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/medecin/dossiers')}
            className="text-sm font-semibold text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            {t('common.back')}
          </button>
        </div>
      </form>
    </MedecinShell>
  )
}
