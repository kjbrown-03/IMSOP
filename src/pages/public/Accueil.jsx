import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Navbar from '../../components/layout/Navbar'

const heroImage = '/hero-illustration.png'

const AVATARS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuD-s6lR-Dp7PeH8eaqsm5oQ7DBornFlmYwW4hLPTHeYKvq0HPW0oWPyN-r7HaTBTQRsVtYVFwYSiar22AtxMV9rbzWk1oQfYx5rcR4qQ_O3R71i5ShTTC5srY5z8j3Jr0jix_yEVTgZEncEUZENMkVx3MwqQa0tU45zKI5T1BSyuiLnD__7PQhey3BSgBxoLYl3GuPGYMmWmKatL0ZIs3hs9bJFI9koJs50IqbOOaIfXiAnBFel4XjX',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAG2CEHJe1UWpT9r0yJIJ0f7clk7jU6FvPz61rSEI9xXCAJC2l1eskGcix_om1Km6Mn-oa3AHAupsEkrY136Ki61YQszvWnGb5EVQQQ53GvmWNe51kmg5p05bgEzxtjPPEMy7DNPbB90vSi3iJk8u9kOtzk5Mjo_8y4RBqALbJkYTgH73yc8FJ7u89pXvsCi_PAsB1CAmiH-cWnubV_w4Px28UBPdwM9hm4mtRGKjk7sDFsc1b2YeNZ',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC9wkkCxrEV1NOqXuTTANOCbnBr1irLt3NuieDxMj6fwraEqIbzS1cX9fCu-zZfh4FccwhMd2Bc9Yg4_MGJoLfR7C7X3VvIR2W3oxVDoEIDaSLynlsjDprAAJqM3Jtj77ochfN0KX2IhK__S1a8ZSMpZUVNE7gYz-RG5X38qdybPSFyDSjrrwGWVejRTk1hSnFFPBcCU_I1tG1Lnx18HTVhPwecLJAFM3F-LOBo3Yu0OrIO2-o77DnI',
]

function Badge({ icon, text }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] bg-[var(--color-surface)]">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <span className="font-bold text-[var(--color-text-primary)] text-sm">{text}</span>
    </div>
  )
}

export default function Accueil() {
  const { t } = useTranslation()

  const steps = [
    { n: 1, title: t('public.home.step1Title'), text: t('public.home.step1Text') },
    { n: 2, title: t('public.home.step2Title'), text: t('public.home.step2Text') },
    { n: 3, title: t('public.home.step3Title'), text: t('public.home.step3Text') },
  ]

  const specialites = [
    { icon: 'oncology', label: t('public.home.specOncology') },
    { icon: 'cardiology', label: t('public.home.specCardiology') },
    { icon: 'neurology', label: t('public.home.specNeurology') },
    { icon: 'orthopedics', label: t('public.home.specOrthopedics') },
    { icon: 'radiology', label: t('public.home.specRadiology') },
    { icon: 'biotech', label: t('public.home.specPathology') },
  ]

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text-main)] antialiased font-sans overflow-x-hidden transition-colors duration-300">
      <Navbar />

      <main className="min-h-screen">
        <section className="relative w-full pt-28 pb-16 px-4 md:px-8 max-w-[1440px] mx-auto overflow-hidden min-h-[700px] flex flex-col justify-center">
          {/* Background shapes */}
          <div className="absolute top-0 left-0 w-full h-24 bg-[var(--color-surface-container-highest)] -z-10 transition-colors duration-300" />
          <svg className="absolute top-12 left-0 w-full h-[800px] -z-10 object-cover opacity-100 transition-colors duration-300" preserveAspectRatio="none" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0H1440V100C1440 100 1100 200 800 350C500 500 100 650 0 800V0Z" className="fill-[var(--color-surface-container-highest)]"/>
          </svg>

          <div className="max-w-[1200px] mx-auto w-full flex flex-col-reverse md:flex-row items-center gap-12 relative z-10">
            {/* Left side: Illustration */}
            <div className="w-full md:w-1/2 relative flex justify-center mt-12 md:mt-0">
               <img
                 src={heroImage}
                 alt="Patiente en téléconsultation avec un spécialiste"
                 className="w-full max-w-[440px] drop-shadow-2xl rounded-3xl"
                 style={{ imageRendering: 'auto' }}
               />
            </div>

            {/* Right side: Text */}
            <div className="w-full md:w-1/2 flex flex-col items-start gap-6 pt-12 md:pt-0">
              <h1 className="font-display font-extrabold text-5xl md:text-6xl text-[var(--color-heading)] leading-[1.1] tracking-tight uppercase">
                {t('public.home.heroTitle')}
              </h1>
              <p className="text-xl text-[var(--color-text-secondary)] max-w-[480px]">
                {t('public.home.heroSub')}
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-6 mt-4 w-full sm:w-auto">
                <Link to="/inscription" className="bg-[var(--color-primary)] text-[var(--color-on-primary)] px-8 py-4 rounded-full font-bold shadow-xl hover:opacity-90 transition-all w-full sm:w-auto text-center whitespace-nowrap">
                  {t('public.home.heroPrimaryCta')}
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-text-secondary)] font-medium">{t('nav.or')}</span>
                  <Link to="/#specialites" className="text-[var(--color-secondary)] font-bold underline decoration-2 underline-offset-4 hover:opacity-80 transition-opacity whitespace-nowrap">
                    {t('public.home.heroSecondaryCta')}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="max-w-[1200px] mx-auto w-full mt-24 flex flex-wrap justify-center md:justify-between gap-6 border-t border-[var(--color-border)] pt-10 px-4">
            <Badge icon="verified" text={t('public.home.badgeIso')} />
            <Badge icon="gpp_good" text={t('public.home.badgeGdpr')} />
            <Badge icon="group" text={t('public.home.badgeDoctors')} />
            <Badge icon="public" text={t('public.home.badgeTrust')} />
            <Badge icon="lock" text={t('public.home.badgeSecure')} />
          </div>
        </section>

        <section
          className="w-full py-stack-lg px-margin-mobile md:px-margin-desktop bg-[var(--color-muted-surface)] border-y border-[var(--color-border)] transition-colors duration-300"
          id="fonctionnement"
        >
          <div className="max-w-[1200px] mx-auto">
            <div className="text-center mb-stack-lg">
              <span className="font-label-sm text-label-sm text-[var(--color-primary)] uppercase tracking-wider">
                {t('public.home.processEyebrow')}
              </span>
              <h2 className="font-headline-md text-headline-md-mobile md:text-headline-md text-[var(--color-heading)] mt-2">
                {t('public.home.processTitle')}
              </h2>
            </div>
            <div className="relative">
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-[var(--color-border)] -translate-y-1/2 z-0" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-lg md:gap-gutter relative z-10">
                {steps.map((step) => (
                  <div
                    key={step.n}
                    className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 flex flex-col items-center text-center shadow-sm relative transition-colors duration-300"
                  >
                    <div className="w-12 h-12 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-full flex items-center justify-center font-headline-md text-headline-md mb-4 shadow-md">
                      {step.n}
                    </div>
                    <h3 className="font-label-md text-label-md text-[var(--color-text-primary)] mb-2">
                      {step.title}
                    </h3>
                    <p className="font-body-md text-body-md text-[var(--color-text-secondary)]">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-stack-lg px-margin-mobile md:px-margin-desktop bg-[var(--color-bg)] transition-colors duration-300" id="specialites">
          <div className="max-w-[1200px] mx-auto">
            <div className="text-center mb-stack-lg">
              <span className="font-label-sm text-label-sm text-[var(--color-primary)] uppercase tracking-wider">
                {t('public.home.specialtiesEyebrow')}
              </span>
              <h2 className="font-headline-md text-headline-md-mobile md:text-headline-md text-[var(--color-heading)] mt-2">
                {t('public.home.specialtiesTitle')}
              </h2>
              <p className="font-body-md text-body-md text-[var(--color-text-secondary)] mt-2 max-w-2xl mx-auto">
                {t('public.home.specialtiesSub')}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {specialites.map((s) => (
                <div
                  key={s.label}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 flex flex-col items-center text-center gap-3 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] flex items-center justify-center">
                    <span className="material-symbols-outlined">{s.icon}</span>
                  </div>
                  <span className="font-label-md text-label-md text-[var(--color-text-primary)]">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
