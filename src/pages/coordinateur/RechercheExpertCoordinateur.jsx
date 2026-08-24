import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { useLiveRefresh } from '../../components/hooks/useLiveRefresh'

const COORDINATOR_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC244iS5VLN_Ewwm4MnaUp2E4a7Qp16djsX_DfUYcZPJxZqQAMeIuBKC8T-TWhjBMl-DqLrYEAEf5TMtkB3WUbH8eAKSK6dV6l5Hn-qQSSPnUTJZtEXuo__7agmG224P6yvl9XluXoutvvnlRnCqLizjuVvF38AR8_2F5cEh43UhTTgfaADrXmyvI2keWrrrEqjPk_Io7PgrhmRN2yk6lSuo_9ABDsOzZ2aFcm1gTxmfnxQOqLF-ieP'

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
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [specialiteKey, setSpecialiteKey] = useState('')
  const [pays, setPays] = useState('')
  const [disponibleOnly, setDisponibleOnly] = useState(false)
  const [specialistes, setSpecialistes] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // `silencieux` : un rafraichissement de fond ne doit pas faire clignoter la
  // liste en repassant par l'ecran de chargement.
  const load = useCallback(
    async ({ silencieux = false } = {}) => {
      if (!silencieux) setLoading(true)
      try {
        const { data } = await api.get('/specialistes', {
          params: {
            specialite: SPECIALITE_FR[specialiteKey] || undefined,
            pays: pays || undefined,
            disponible: disponibleOnly ? 'true' : undefined,
            pageSize: 20,
          },
        })
        setSpecialistes(data.items)
        setTotal(data.total)
        setError(null)
      } catch (err) {
        if (!silencieux) setError(err.response?.data?.message || t('coordinateur.search.loadFailed'))
      } finally {
        if (!silencieux) setLoading(false)
      }
    },
    [specialiteKey, pays, disponibleOnly, t],
  )

  useEffect(() => {
    load()
  }, [load])

  // La disponibilite d'un specialiste change depuis SON ecran a lui : sans
  // relecture, le coordinateur gardait une liste perimee jusqu'au rechargement.
  useLiveRefresh(() => load({ silencieux: true }))

  return (
    <div className="bg-background text-text-main font-body-md min-h-screen relative">
      <header className="fixed top-0 w-full z-50 bg-surface border-b border-outline-variant flex justify-between items-center px-margin-mobile h-12">
        <button onClick={() => navigate('/coordinateur/tableau-de-bord')}>
          <img className="w-8 h-8 rounded-full object-cover shadow-sm border border-surface-variant cursor-pointer" src={COORDINATOR_AVATAR} alt="Coordinateur" />
        </button>
        <div className="font-headline-md text-headline-md-mobile font-bold text-primary tracking-tight">IMSOP</div>
        <div className="w-8" />
      </header>

      <aside className="hidden md:flex flex-col fixed top-[48px] left-0 w-64 h-[calc(100vh-48px)] bg-surface border-r border-outline-variant p-4 overflow-y-auto">
        <nav className="flex flex-col gap-2 mt-4">
          <button onClick={() => navigate('/coordinateur/tableau-de-bord')} className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors font-label-md text-left">
            <span className="material-symbols-outlined">folder_shared</span> {t('shell.coordinatorNav.dossiers')}
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary-container text-on-primary-container font-label-md text-left">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>medical_services</span> {t('shell.coordinatorNav.experts')}
          </button>
          <button onClick={() => navigate('/coordinateur/identites')} className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors font-label-md text-left">
            <span className="material-symbols-outlined">shield_person</span> {t('shell.coordinatorNav.identites')}
          </button>
        </nav>
      </aside>

      <main className="pt-[48px] pb-[80px] md:pb-8 md:pl-[256px] px-margin-mobile md:px-margin-desktop max-w-[1400px] mx-auto w-full flex flex-col md:flex-row gap-gutter mt-stack-md">
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
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 py-3 bg-surface shadow-[0_-1px_3px_rgba(0,0,0,0.05)] rounded-t-xl">
        <button onClick={() => navigate('/coordinateur/tableau-de-bord')} className="flex flex-col items-center justify-center text-on-surface-variant opacity-70 hover:text-primary transition-colors active:scale-95 duration-200">
          <span className="material-symbols-outlined">folder_shared</span>
          <span className="font-label-sm text-label-sm mt-1">{t('shell.coordinatorNav.dossiers')}</span>
        </button>
        <button className="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-4 py-1 active:scale-95 transition-transform duration-200">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>medical_services</span>
          <span className="font-label-sm text-label-sm mt-1">{t('shell.coordinatorNav.experts')}</span>
        </button>
        <button onClick={() => navigate('/coordinateur/identites')} className="flex flex-col items-center justify-center text-on-surface-variant opacity-70 hover:text-primary transition-colors active:scale-95 duration-200">
          <span className="material-symbols-outlined">shield_person</span>
          <span className="font-label-sm text-label-sm mt-1">{t('shell.coordinatorNav.identites')}</span>
        </button>
      </nav>
    </div>
  )
}
