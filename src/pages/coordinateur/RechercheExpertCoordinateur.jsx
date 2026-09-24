import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { useLiveRefresh } from '../../components/hooks/useLiveRefresh'
import CoordinatorLayout from '../../components/layout/CoordinatorLayout'

// Le champ « pays » est libre : sans délai, chaque caractère partait en requête.
// Les listes déroulantes et la case à cocher changent d'un coup et n'ont rien à
// attendre — seule la saisie est différée.
const DELAI_FRAPPE = 300

const SPECIALITE_KEYS = [
  'oncologie', 'cardiologie', 'neurologie', 'orthopedie', 'radiologie', 'anatomopathologie',
  'pediatrie', 'gynecologie', 'nephrologie', 'gastroenterologie', 'pneumologie',
]

// Sent to the backend in French regardless of UI language: the API filters
// Specialiste.specialite with a plain text match against values stored in
// French (see seed data / registration), so the query itself must stay French.
const SPECIALITE_FR = {
  oncologie: 'Oncologie', cardiologie: 'Cardiologie', neurologie: 'Neurologie', orthopedie: 'Orthopédie',
  radiologie: 'Radiologie', anatomopathologie: 'Anatomopathologie', pediatrie: 'Pédiatrie',
  gynecologie: 'Gynécologie-obstétrique', nephrologie: 'Néphrologie',
  gastroenterologie: 'Gastro-entérologie', pneumologie: 'Pneumologie',
}

export default function RechercheExpertCoordinateur() {
  const { t } = useTranslation()
  const [specialiteKey, setSpecialiteKey] = useState('')
  const [pays, setPays] = useState('')
  const [disponibleOnly, setDisponibleOnly] = useState(false)
  // Valeur réellement envoyée au serveur, en retard d'un délai sur la frappe.
  const [paysRecherche, setPaysRecherche] = useState('')
  const [specialistes, setSpecialistes] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const minuteur = setTimeout(() => setPaysRecherche(pays), DELAI_FRAPPE)
    return () => clearTimeout(minuteur)
  }, [pays])

  // En tapant vite, les réponses ne reviennent pas dans l'ordre où elles sont
  // parties : ce compteur empêche une réponse lente de recouvrir une plus
  // récente déjà affichée.
  const requeteRef = useRef(0)

  // `silencieux` : un rafraichissement de fond ne doit pas faire clignoter la
  // liste en repassant par l'ecran de chargement.
  const load = useCallback(
    async ({ silencieux = false } = {}) => {
      const numero = ++requeteRef.current
      if (!silencieux) setLoading(true)
      try {
        const { data } = await api.get('/specialistes', {
          params: {
            specialite: SPECIALITE_FR[specialiteKey] || undefined,
            pays: paysRecherche || undefined,
            disponible: disponibleOnly ? 'true' : undefined,
            pageSize: 20,
          },
        })
        if (numero !== requeteRef.current) return
        setSpecialistes(data.items)
        setTotal(data.total)
        setError(null)
      } catch (err) {
        if (numero !== requeteRef.current) return
        if (!silencieux) setError(err.response?.data?.message || t('coordinateur.search.loadFailed'))
      } finally {
        // Une requête dépassée ne doit pas éteindre l'indicateur de la suivante.
        if (!silencieux && numero === requeteRef.current) setLoading(false)
      }
    },
    [specialiteKey, paysRecherche, disponibleOnly, t],
  )

  useEffect(() => {
    load()
  }, [load])

  // La disponibilite d'un specialiste change depuis SON ecran a lui : sans
  // relecture, le coordinateur gardait une liste perimee jusqu'au rechargement.
  useLiveRefresh(() => load({ silencieux: true }))

  // Cette page portait sa propre coque : un en-tete fixe, une barre laterale de
  // bureau et une barre du bas, toutes limitees a trois destinations sur les
  // huit du coordinateur — et sans bouton de menu sur telephone, ce qui y
  // enfermait l'utilisateur. Elle passe donc sous la coque commune.
  return (
    <CoordinatorLayout>
      <div className="w-full flex flex-col md:flex-row gap-gutter">
        <section className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0 flex flex-col gap-stack-sm">
          <div className="mb-2">
            <h1 className="font-headline-lg text-headline-lg-mobile text-on-surface">{t('coordinateur.search.title')}</h1>
            <p className="font-body-md text-on-surface-variant mt-1">{t('coordinateur.search.subtitle')}</p>
          </div>
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 no-scrollbar w-full">
            <div className="relative min-w-[140px] md:w-full">
              <select
                className="w-full appearance-none bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 pr-10 font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                value={specialiteKey}
                onChange={(e) => setSpecialiteKey(e.target.value)}
              >
                <option value="">{t('coordinateur.search.allSpecialties')}</option>
                {SPECIALITE_KEYS.map((key) => (
                  <option key={key} value={key}>{t(`common.specialites.${key}`)}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">arrow_drop_down</span>
            </div>
            <div className="relative min-w-[140px] md:w-full">
              <input
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder={t('coordinateur.search.countryPlaceholder')}
                type="text"
                value={pays}
                onChange={(e) => setPays(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg cursor-pointer min-w-[160px] md:w-full">
              <input type="checkbox" checked={disponibleOnly} onChange={(e) => setDisponibleOnly(e.target.checked)} className="w-4 h-4" />
              <span className="font-label-md text-on-surface">{t('coordinateur.search.availableOnly')}</span>
            </label>
          </div>
        </section>

        <section className="w-full md:w-2/3 lg:w-3/4 flex-grow">
          {error && <div className="bg-error-container text-on-error-container text-label-sm font-label-sm rounded-lg px-4 py-3 mb-4">{error}</div>}
          <p className="font-label-md text-on-surface-variant mb-4 hidden md:block">
            {loading ? t('coordinateur.search.searching') : t('coordinateur.search.found', { count: total })}
          </p>

          {!loading && specialistes.length === 0 && !error && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-10 text-center text-on-surface-variant">
              {t('coordinateur.search.noMatch')}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
            {specialistes.map((s) => (
              <article key={s.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1 h-full ${s.disponible ? 'bg-secondary' : 'bg-surface-variant'}`} />
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-surface-variant border border-outline flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[32px] text-outline">person</span>
                  </div>
                  <div className="flex-1">
                    <h2 className="font-headline-md text-headline-md-mobile text-on-surface group-hover:text-primary transition-colors">
                      {s.user.fullName}
                    </h2>
                    <p className="font-body-md text-primary mt-1">{s.specialite}</p>
                    <div className="flex flex-wrap items-center gap-4 mt-2">
                      {s.pays && (
                        <p className="font-label-sm text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">location_city</span> {s.pays}
                        </p>
                      )}
                      {s.langues && (
                        <p className="font-label-sm text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">language</span> {s.langues}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                {s.bio && (
                  <div className="bg-surface px-3 py-2 rounded-lg border border-surface-variant mt-2">
                    <p className="font-label-sm text-on-surface-variant line-clamp-2">{s.bio}</p>
                  </div>
                )}
                <div className="flex justify-between items-center mt-auto pt-4 border-t border-surface-variant">
                  <span className={`font-label-md px-3 py-1 rounded-full flex items-center gap-1 ${s.disponible ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-[16px]">{s.disponible ? 'check_circle' : 'schedule'}</span>
                    {s.disponible ? t('coordinateur.search.available') : t('coordinateur.search.unavailable')}
                  </span>
                  {s.verificationStatus === 'VALIDE' && (
                    <span className="text-primary font-label-md flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                      {t('coordinateur.search.verified')}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </CoordinatorLayout>
  )
}
