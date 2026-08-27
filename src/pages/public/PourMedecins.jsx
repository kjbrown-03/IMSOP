import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Navbar from '../../components/layout/Navbar'

export default function PourMedecins() {
  const { t } = useTranslation()

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text-main)] antialiased font-body-md overflow-x-hidden min-h-screen transition-colors duration-300">
      <Navbar />
      <main className="pt-16 pb-28 md:pb-0">
        <section className="w-full py-16 px-margin-mobile md:px-margin-desktop bg-[var(--color-surface)] border-b border-[var(--color-border)]">
          <div className="max-w-[900px] mx-auto text-center">
            <span className="font-label-sm text-label-sm text-[var(--color-primary)] uppercase tracking-wider">
              {t('public.forDoctors.eyebrow')}
            </span>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-[var(--color-primary)] mt-2">
              {t('public.forDoctors.title')}
            </h1>
            <p className="font-body-lg text-body-lg text-[var(--color-text-secondary)] mt-4">
              {t('public.forDoctors.intro')}
            </p>
          </div>
        </section>

        <section className="max-w-[1000px] mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg grid grid-cols-1 md:grid-cols-2 gap-gutter">
          <div className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm dark:bg-neutral-900 transition-colors duration-300 hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)]">
            <div className="w-12 h-12 rounded-full bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] flex items-center justify-center mb-4 transition-colors duration-300 group-hover:bg-white/15 group-hover:text-white">
              <span className="material-symbols-outlined">person_add</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-[var(--color-text-main)] mb-2 transition-colors duration-300 group-hover:text-white">{t('public.forDoctors.doctorsTitle')}</h2>
            <p className="font-body-md text-body-md text-[var(--color-text-secondary)] mb-4 transition-colors duration-300 group-hover:text-white/85">
              {t('public.forDoctors.doctorsText')}
            </p>
            <ul className="space-y-2 font-body-md text-body-md text-[var(--color-text-main)] transition-colors duration-300 group-hover:text-white">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[var(--color-secondary)] text-[18px] mt-0.5 transition-colors duration-300 group-hover:text-white">check_circle</span>
                {t('public.forDoctors.doctorsItem1')}
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[var(--color-secondary)] text-[18px] mt-0.5 transition-colors duration-300 group-hover:text-white">check_circle</span>
                {t('public.forDoctors.doctorsItem2')}
              </li>
            </ul>
          </div>

          <div className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm dark:bg-neutral-900 transition-colors duration-300 hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)]">
            <div className="w-12 h-12 rounded-full bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] flex items-center justify-center mb-4 transition-colors duration-300 group-hover:bg-white/15 group-hover:text-white">
              <span className="material-symbols-outlined">verified_user</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-[var(--color-text-main)] mb-2 transition-colors duration-300 group-hover:text-white">{t('public.forDoctors.specialistsTitle')}</h2>
            <p className="font-body-md text-body-md text-[var(--color-text-secondary)] mb-4 transition-colors duration-300 group-hover:text-white/85">
              {t('public.forDoctors.specialistsText')}
            </p>
            <ul className="space-y-2 font-body-md text-body-md text-[var(--color-text-main)] transition-colors duration-300 group-hover:text-white">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[var(--color-secondary)] text-[18px] mt-0.5 transition-colors duration-300 group-hover:text-white">check_circle</span>
                {t('public.forDoctors.specialistsItem1')}
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[var(--color-secondary)] text-[18px] mt-0.5 transition-colors duration-300 group-hover:text-white">check_circle</span>
                {t('public.forDoctors.specialistsItem2')}
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[var(--color-secondary)] text-[18px] mt-0.5 transition-colors duration-300 group-hover:text-white">check_circle</span>
                {t('public.forDoctors.specialistsItem3')}
              </li>
            </ul>
          </div>
        </section>

        <section className="px-margin-mobile md:px-margin-desktop py-16">
          <div className="max-w-[900px] mx-auto bg-[var(--color-primary)] rounded-3xl p-8 md:p-12 text-center text-white shadow-xl">
            <h2 className="font-headline-md mb-4">{t('public.forDoctors.ctaTitle')}</h2>
            <p className="mb-8 opacity-90 max-w-xl mx-auto">
              {t('public.forDoctors.ctaText')}
            </p>
            <Link
              to="/connexion/coordinateur"
              className="inline-block bg-[var(--color-surface)] text-[var(--color-primary)] font-label-md py-3 px-8 rounded-full hover:bg-[var(--color-bg)] transition-colors"
            >
              {t('public.forDoctors.ctaButton')}
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
