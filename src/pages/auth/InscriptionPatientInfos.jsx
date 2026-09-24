import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import RegistrationHeader from '../../components/auth/RegistrationHeader'
import RegistrationStepper from '../../components/auth/RegistrationStepper'
import { useRegistrationStore } from '../../store/useRegistrationStore'
import { PAYS_DE_LA_LISTE, VILLES_CAMEROUN, VILLE_AUTRE } from '../../lib/villesCameroun'

const COUNTRY_CODES = ['sn', 'ci', 'cm', 'fr', 'be', 'ch']
const LANGUAGE_CODES = ['fr', 'en']

export default function InscriptionPatientInfos() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const {
    fullName, dob, gender, phone, nationality, country, city, preferredLanguage,
    emergencyContactName, emergencyContactPhone, email, setField,
  } = useRegistrationStore()

  // La liste ne vaut que pour le Cameroun ; ailleurs, le champ reste libre.
  // Proposer Douala à quelqu'un qui habite Lyon n'aurait pas de sens.
  const listeApplicable = country === PAYS_DE_LA_LISTE
  // Une ville déjà saisie et absente de la liste (compte repris, autre pays)
  // doit rouvrir le champ libre plutôt que d'être silencieusement effacée.
  const [villeLibre, setVilleLibre] = useState(Boolean(city) && !VILLES_CAMEROUN.includes(city))

  function choisirVille(valeur) {
    if (valeur === VILLE_AUTRE) {
      setVilleLibre(true)
      setField('city', '')
      return
    }
    setField('city', valeur)
  }

  function onNext(e) {
    e.preventDefault()
    navigate('/inscription/securite')
  }

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text-main)] antialiased flex flex-col min-h-screen transition-colors duration-300">
      <RegistrationHeader onBack={() => navigate('/connexion/patient')} />
      <main className="flex-grow pt-[48px] px-margin-mobile pb-24 md:pb-8 flex flex-col items-center md:max-w-[1200px] md:mx-auto w-full">
        <div className="w-full max-w-lg mt-stack-md flex flex-col gap-stack-lg">
          <div className="text-center md:text-left">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-[var(--color-heading)] mb-2">
              {t('auth.registerInfos.title')}
            </h2>
            <p className="font-body-md text-body-md text-[var(--color-text-secondary)]">{t('auth.registerInfos.subtitle')}</p>
          </div>

          <RegistrationStepper current={1} />

          <form onSubmit={onNext} className="flex flex-col gap-stack-md bg-[var(--color-surface)] p-6 rounded-xl border border-[var(--color-border)] shadow-sm">
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-[var(--color-text-main)]" htmlFor="fullName">
                {t('auth.registerInfos.fullName')}
              </label>
              <input
                className="h-12 px-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] font-body-md text-body-md text-[var(--color-text-main)] placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
                id="fullName"
                name="fullName"
                placeholder={t('auth.registerInfos.fullNamePlaceholder')}
                required
                type="text"
                value={fullName}
                onChange={(e) => setField('fullName', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-[var(--color-text-main)]" htmlFor="email">
                {t('common.email')}
              </label>
              <input
                className="h-12 px-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] font-body-md text-body-md text-[var(--color-text-main)] placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
                id="email"
                name="email"
                placeholder="votre.email@exemple.com"
                required
                type="email"
                value={email}
                onChange={(e) => setField('email', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-[var(--color-text-main)]" htmlFor="dob">
                {t('auth.registerInfos.dob')}
              </label>
              <input
                className="h-12 px-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] font-body-md text-body-md text-[var(--color-text-main)] transition-colors"
                id="dob"
                name="dob"
                required
                type="date"
                value={dob}
                onChange={(e) => setField('dob', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <span className="font-label-md text-label-md text-[var(--color-text-main)]">{t('auth.registerInfos.gender')}</span>
              <div className="flex gap-4">
                {['homme', 'femme'].map((g) => (
                  <label key={g} className="flex items-center gap-2 cursor-pointer">
                    <input
                      className="w-5 h-5 text-[var(--color-primary)] border-[var(--color-border)] focus:ring-[var(--color-primary)] focus:ring-offset-[var(--color-bg)] bg-[var(--color-surface)]"
                      name="gender"
                      required
                      type="radio"
                      value={g}
                      checked={gender === g}
                      onChange={(e) => setField('gender', e.target.value)}
                    />
                    <span className="font-body-md text-body-md text-[var(--color-text-secondary)] capitalize">
                      {t(`auth.registerInfos.gender${g.charAt(0).toUpperCase()}${g.slice(1)}`)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1 mt-2">
              <label className="font-label-md text-label-md text-[var(--color-text-main)]" htmlFor="phone">
                {t('auth.registerInfos.phone')}
              </label>
              <div className="flex relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] material-symbols-outlined text-[20px]">
                  phone
                </span>
                <input
                  className="h-12 w-full pl-11 pr-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] font-body-md text-body-md text-[var(--color-text-main)] placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
                  id="phone"
                  name="phone"
                  placeholder="+237 6 12 34 56 78"
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setField('phone', e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-[var(--color-text-main)]" htmlFor="country">
                {t('auth.registerInfos.country')}
              </label>
              <div className="relative">
                <select
                  className="h-12 w-full px-4 pr-10 appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] font-body-md text-body-md text-[var(--color-text-main)] transition-colors cursor-pointer"
                  id="country"
                  name="country"
                  required
                  value={country}
                  onChange={(e) => setField('country', e.target.value)}
                >
                  <option disabled value="">
                    {t('auth.registerInfos.countrySelect')}
                  </option>
                  {COUNTRY_CODES.map((code) => (
                    <option key={code} value={code}>
                      {t(`auth.registerInfos.countries.${code}`)}
                    </option>
                  ))}
                </select>
                <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-secondary)] material-symbols-outlined">
                  expand_more
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-[var(--color-text-main)]" htmlFor="nationality">
                {t('auth.registerInfos.nationality')}
              </label>
              <div className="relative">
                <select
                  className="h-12 w-full px-4 pr-10 appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] font-body-md text-body-md text-[var(--color-text-main)] transition-colors cursor-pointer"
                  id="nationality"
                  name="nationality"
                  required
                  value={nationality}
                  onChange={(e) => setField('nationality', e.target.value)}
                >
                  <option disabled value="">
                    {t('auth.registerInfos.nationalitySelect')}
                  </option>
                  {COUNTRY_CODES.map((code) => (
                    <option key={code} value={code}>
                      {t(`auth.registerInfos.countries.${code}`)}
                    </option>
                  ))}
                </select>
                <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-secondary)] material-symbols-outlined">
                  expand_more
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-[var(--color-text-main)]" htmlFor="city">
                {t('auth.registerInfos.city')}
              </label>
              {listeApplicable && !villeLibre ? (
                <div className="relative">
                  <select
                    className="h-12 w-full px-4 pr-10 appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] font-body-md text-body-md text-[var(--color-text-main)] transition-colors cursor-pointer"
                    id="city"
                    name="city"
                    required
                    value={city}
                    onChange={(e) => choisirVille(e.target.value)}
                  >
                    <option disabled value="">
                      {t('auth.registerInfos.citySelect')}
                    </option>
                    {VILLES_CAMEROUN.map((ville) => (
                      <option key={ville} value={ville}>
                        {ville}
                      </option>
                    ))}
                    <option value={VILLE_AUTRE}>{t('auth.registerInfos.cityOther')}</option>
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-secondary)] material-symbols-outlined">
                    expand_more
                  </span>
                </div>
              ) : (
                <>
                  <input
                    className="h-12 px-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] font-body-md text-body-md text-[var(--color-text-main)] placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
                    id="city"
                    name="city"
                    placeholder={t('auth.registerInfos.cityPlaceholder')}
                    required
                    type="text"
                    value={city}
                    onChange={(e) => setField('city', e.target.value)}
                  />
                  {listeApplicable && (
                    <button
                      type="button"
                      onClick={() => { setVilleLibre(false); setField('city', '') }}
                      className="self-start text-label-sm font-label-sm text-[var(--color-primary)] hover:underline"
                    >
                      {t('auth.registerInfos.cityBackToList')}
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-[var(--color-text-main)]" htmlFor="preferredLanguage">
                {t('auth.registerInfos.preferredLanguage')}
              </label>
              <div className="relative">
                <select
                  className="h-12 w-full px-4 pr-10 appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] font-body-md text-body-md text-[var(--color-text-main)] transition-colors cursor-pointer"
                  id="preferredLanguage"
                  name="preferredLanguage"
                  required
                  value={preferredLanguage}
                  onChange={(e) => setField('preferredLanguage', e.target.value)}
                >
                  {LANGUAGE_CODES.map((code) => (
                    <option key={code} value={code}>
                      {t(`auth.registerInfos.languages.${code}`)}
                    </option>
                  ))}
                </select>
                <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-secondary)] material-symbols-outlined">
                  expand_more
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--color-border)]">
              <p className="font-label-md text-label-md text-[var(--color-text-main)] mt-4 mb-1">
                {t('auth.registerInfos.emergencyTitle')}
              </p>
              <p className="font-label-sm text-label-sm text-[var(--color-text-secondary)] mb-3">
                {t('auth.registerInfos.emergencySubtitle')}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-[var(--color-text-main)]" htmlFor="emergencyContactName">
                {t('auth.registerInfos.emergencyName')}
              </label>
              <input
                className="h-12 px-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] font-body-md text-body-md text-[var(--color-text-main)] placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
                id="emergencyContactName"
                name="emergencyContactName"
                placeholder="Ex: Marie Dupont"
                type="text"
                value={emergencyContactName}
                onChange={(e) => setField('emergencyContactName', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-[var(--color-text-main)]" htmlFor="emergencyContactPhone">
                {t('auth.registerInfos.emergencyPhone')}
              </label>
              <input
                className="h-12 px-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] font-body-md text-body-md text-[var(--color-text-main)] placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
                id="emergencyContactPhone"
                name="emergencyContactPhone"
                placeholder="+237 6 12 34 56 78"
                type="tel"
                value={emergencyContactPhone}
                onChange={(e) => setField('emergencyContactPhone', e.target.value)}
              />
            </div>

            <div className="fixed bottom-0 left-0 w-full p-margin-mobile bg-[var(--color-surface)]/90 backdrop-blur-sm border-t border-[var(--color-border)] md:relative md:bg-transparent md:border-none md:p-0 md:mt-4 z-40">
              <div className="max-w-lg mx-auto w-full">
                <button
                  className="group relative overflow-hidden w-full h-12 flex items-center justify-center bg-[var(--color-surface)] border border-[var(--color-primary)] rounded-xl shadow-sm z-[1] transition-all duration-300 active:scale-[0.98]"
                  type="submit"
                >
                  <div className="absolute inset-0 w-full h-full bg-[var(--color-primary)] scale-y-0 origin-bottom transition-transform duration-500 ease-in-out group-hover:scale-y-100 z-[-1]" />
                  <span className="relative z-10 flex items-center justify-center font-label-md text-label-md text-[var(--color-primary)] transition-colors duration-500 ease-in-out group-hover:text-[var(--color-on-primary)]">
                    {t('auth.registerInfos.next')}
                    <span className="material-symbols-outlined ml-2 text-[20px]">arrow_forward</span>
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
