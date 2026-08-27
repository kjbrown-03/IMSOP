import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import Marquee from '../../components/ui/Marquee'
import Navbar from '../../components/layout/Navbar'
import Logo from '../../components/ui/Logo'
import { api } from '../../lib/api'
import {
  FolderHeart,
  HeartPulse,
  Shield,
  ShieldCheck,
  Users,
  Globe2,
  Lock,
  Stethoscope,
  Brain,
  Bone,
  ScanLine,
  Microscope,
  Quote,
  Clock,
  ArrowRight,
  ArrowUpRight,
} from 'lucide-react'

const SPECIALTIES = [
  { icon: HeartPulse, nameKey: 'specOncology', subKey: 'specOncologySub' },
  { icon: Stethoscope, nameKey: 'specCardiology', subKey: 'specCardiologySub' },
  { icon: Brain, nameKey: 'specNeurology', subKey: 'specNeurologySub' },
  { icon: Bone, nameKey: 'specOrthopedics', subKey: 'specOrthopedicsSub' },
  { icon: ScanLine, nameKey: 'specRadiology', subKey: 'specRadiologySub' },
  { icon: Microscope, nameKey: 'specPathology', subKey: 'specPathologySub' },
]

function TrustBadge({ icon: Icon, children }) {
  return (
    <span className="flex items-center gap-2.5 font-semibold text-[12.5px] tracking-wide text-[#DCE7EA]">
      <Icon className="w-[18px] h-[18px] text-[#8FC4BA]" strokeWidth={2} />
      {children}
    </span>
  )
}

// Les témoignages sont décrits ici plutôt qu'écrits en dur dans le rendu : le
// jour où ils viendront de l'API (avis déposés par les patients après réception
// de leur rapport), seule la source du tableau changera, pas le reste.
// Nombre de témoignages réels, modérés et publiés, à partir duquel la section
// bascule sur du contenu authentique. En dessous, on affiche des SITUATIONS
// TYPES, signalées comme telles : une plateforme médicale ne peut pas présenter
// des paroles inventées comme de vrais retours de patients (CDC §7 :
// « Témoignages lorsque légalement autorisés »).
export const SEUIL_TEMOIGNAGES_REELS = 5

const EXEMPLES = [
  { cle: 'ex1', citation: 'testimonial1Quote', meta: 'testimonial1Meta', auteur: 'testimonialExampleLabel', pastille: 'bg-[#E4DACE] dark:bg-[#22404C] group-hover:bg-white/20', variante: 'clair' },
  { cle: 'ex2', citation: 'testimonial2Quote', meta: 'testimonial2Meta', auteur: 'testimonialExampleLabel', pastille: 'bg-[#D3DFDC] dark:bg-[#22404C] group-hover:bg-white/20', variante: 'clair' },
  { cle: 'ex3', citation: 'testimonial3Quote', meta: 'testimonial3Meta', auteur: 'testimonialExampleLabel', pastille: 'bg-white/15 group-hover:bg-white/25', variante: 'sombre' },
  { cle: 'ex4', citation: 'testimonial4Quote', meta: 'testimonial4Meta', auteur: 'testimonialExampleLabel', pastille: 'bg-[#E4DACE] dark:bg-[#22404C] group-hover:bg-white/20', variante: 'clair' },
  { cle: 'ex5', citation: 'testimonial5Quote', meta: 'testimonial5Meta', auteur: 'testimonialExampleLabel', pastille: 'bg-white/15 group-hover:bg-white/25', variante: 'sombre' },
]

// Deux habillages, une seule structure. Au survol, la carte claire bascule sur
// le bleu profond de la charte et la carte sombre s'éclaircit vers le vert
// d'eau : dans les deux cas le contraste du texte est recalculé avec elle.
function TestimonialCard({ temoignage, t }) {
  const sombre = temoignage.variante === 'sombre'
  const citation = temoignage.raw ? temoignage.citation : t(`public.home.${temoignage.citation}`)
  const auteur = temoignage.raw ? temoignage.auteur : t(`public.home.${temoignage.auteur}`)
  const meta = temoignage.raw ? temoignage.meta : t(`public.home.${temoignage.meta}`)

  return (
    <article
      className={[
        'group w-[300px] sm:w-[340px] md:w-[360px] rounded-[20px] p-7 flex flex-col gap-5 min-h-[260px]',
        'transition-all duration-300 ease-out cursor-default',
        'hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[#12303F]/15',
        sombre
          ? 'bg-[#163A52] hover:bg-[#2C6E63]'
          : 'bg-white dark:bg-[#132530] border border-[#EBE3D9] dark:border-[#22404C] hover:bg-[#163A52] hover:border-[#163A52]',
      ].join(' ')}
    >
      <Quote
        className={[
          'w-7 h-7 transition-colors duration-300',
          sombre ? 'text-[rgba(143,196,186,0.7)] group-hover:text-white/80' : 'text-[#C9BBA6] dark:text-[#3C4C55] group-hover:text-[#8FC4BA]',
        ].join(' ')}
      />
      <p
        className={[
          'm-0 text-lg leading-relaxed transition-colors duration-300',
          sombre ? 'text-[#EAF1F0]' : 'text-[#22333C] dark:text-[#E7EEF0] group-hover:text-[#EAF1F0]',
        ].join(' ')}
        style={{ fontFamily: 'Newsreader, Georgia, serif' }}
      >
        {citation}
      </p>
      <div className="mt-auto flex items-center gap-3">
        <span className={`w-10 h-10 rounded-full shrink-0 transition-colors duration-300 ${temoignage.pastille}`} />
        <span
          className={[
            'text-sm font-semibold transition-colors duration-300',
            sombre ? 'text-white' : 'text-[#16262F] dark:text-white group-hover:text-white',
          ].join(' ')}
        >
          {auteur}
          <br />
          <span
            className={[
              'font-normal transition-colors duration-300',
              sombre ? 'text-[#9FB6BD]' : 'text-[#7A8890] dark:text-[#93A7AF] group-hover:text-[#9FB6BD]',
            ].join(' ')}
          >
            {meta}
          </span>
        </span>
      </div>
    </article>
  )
}

const PASTILLES = [
  'bg-[#E4DACE] dark:bg-[#22404C] group-hover:bg-white/20',
  'bg-[#D3DFDC] dark:bg-[#22404C] group-hover:bg-white/20',
]

export default function Accueil() {
  const { t } = useTranslation()
  const [temoignagesApi, setTemoignagesApi] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/temoignages/publics')
      .then(({ data }) => {
        if (!cancelled) setTemoignagesApi(data)
      })
      .catch(() => {
        if (!cancelled) setTemoignagesApi([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Tant que le seuil n'est pas atteint, la section reste en mode « situations
  // types » : mélanger deux ou trois vrais témoignages avec des exemples
  // inventés rendrait les uns indiscernables des autres.
  const assezDeTemoignagesReels = (temoignagesApi?.length ?? 0) >= SEUIL_TEMOIGNAGES_REELS

  const temoignagesAffiches =
    assezDeTemoignagesReels
      ? temoignagesApi.map((tem, idx) => ({
          cle: tem.id,
          raw: true,
          citation: tem.texte,
          auteur: tem.user?.fullName || t('public.home.testimonialAnonymous'),
          meta:
            tem.roleAuteur === 'MEDECIN_LOCAL'
              ? t('public.home.testimonialRoleDoctor')
              : t('public.home.testimonialRolePatient'),
          pastille: PASTILLES[idx % PASTILLES.length],
          variante: idx % 3 === 2 ? 'sombre' : 'clair',
        }))
      : EXEMPLES

  return (
    <div
      className="bg-[#FBF7F2] dark:bg-[#0F1D26] text-[#16262F] dark:text-[#E7EEF0] antialiased overflow-x-hidden transition-colors duration-300"
      style={{ fontFamily: "Figtree, system-ui, sans-serif" }}
    >
      <Navbar />

      <main className="pt-16">
        {/* ---------- Hero ---------- */}
        <section
          className="relative px-4 md:px-10 pt-24 pb-16 md:pt-28 md:pb-20 overflow-hidden bg-cover bg-center"
          style={{ backgroundImage: "url(/hero-imsop.jpg)" }}
        >
          <div
            className="absolute inset-0 dark:hidden"
            style={{
              background:
                'linear-gradient(100deg, rgba(251,247,242,.97) 0%, rgba(251,247,242,.93) 34%, rgba(251,247,242,.55) 56%, rgba(18,48,63,.18) 100%)',
            }}
          />
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              background:
                'linear-gradient(100deg, rgba(15,29,38,.97) 0%, rgba(15,29,38,.93) 34%, rgba(15,29,38,.6) 56%, rgba(15,29,38,.25) 100%)',
            }}
          />

          <div className="relative max-w-[1200px] mx-auto">
            <div className="max-w-[620px] flex flex-col items-start gap-6">
              <h1
                className="m-0 text-[42px] md:text-[62px] leading-[1.06] tracking-[-0.02em] text-[#12303F] dark:text-[#F4F8F8]"
                style={{ fontFamily: "Newsreader, Georgia, serif" }}
              >
                {t('public.home.heroTitlePart1')}{' '}
                <span className="italic text-[#3E8C81] dark:text-[#8FC4BA]">{t('public.home.heroTitlePart2')}</span>
              </h1>

              <Link
                to="/inscription"
                className="inline-flex items-center gap-2 bg-[#163A52] dark:bg-[#8FC4BA] text-white dark:text-[#0F2C38] rounded-full px-7 py-4 font-bold text-sm tracking-wide shadow-[0_10px_24px_-10px_rgba(22,58,82,0.6)] hover:opacity-90 transition-opacity"
              >
                {t('public.home.heroPrimaryCta')}
                <ArrowRight className="w-[18px] h-[18px]" />
              </Link>

              <div className="flex items-center gap-3.5 mt-2">
                <div className="flex">
                  <span className="w-9 h-9 rounded-full bg-[#D8CFC2] dark:bg-[#2A4854] border-2 border-[#FBF7F2] dark:border-[#0F1D26]" />
                  <span className="w-9 h-9 rounded-full bg-[#C4D5D1] dark:bg-[#22404C] border-2 border-[#FBF7F2] dark:border-[#0F1D26] -ml-3" />
                  <span className="w-9 h-9 rounded-full bg-[#C7CFD8] dark:bg-[#1B3340] border-2 border-[#FBF7F2] dark:border-[#0F1D26] -ml-3" />
                </div>
                <span className="text-[13.5px] leading-snug text-[#6B7A82] dark:text-[#9FB6BD]">
                  <Trans i18nKey="public.home.heroNetworkCaption" />
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Trust bar ---------- */}
        <div className="bg-[#163A52] py-5">
          <Marquee duree={38} espacement={56} className="px-6 md:px-10">
            <TrustBadge icon={ShieldCheck}>{t('public.home.badgeIso')}</TrustBadge>
            <TrustBadge icon={Shield}>{t('public.home.badgeGdpr')}</TrustBadge>
            <TrustBadge icon={Users}>{t('public.home.badgeDoctors')}</TrustBadge>
            <TrustBadge icon={Globe2}>{t('public.home.badgeTrust')}</TrustBadge>
            <TrustBadge icon={Lock}>{t('public.home.badgeSecure')}</TrustBadge>
          </Marquee>
        </div>

        {/* ---------- How it works ---------- */}
        <section className="px-4 md:px-10 py-16 md:py-20" id="fonctionnement">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10">
              <div className="flex flex-col gap-3 max-w-[640px]">
                <span className="font-semibold text-xs tracking-[0.16em] uppercase text-[#3E8C81] dark:text-[#8FC4BA]">
                  {t('public.home.processEyebrow')}
                </span>
                <h2
                  className="m-0 text-[32px] md:text-[42px] leading-[1.12] tracking-[-0.015em] text-[#12303F] dark:text-[#F4F8F8]"
                  style={{ fontFamily: "Newsreader, Georgia, serif" }}
                >
                  {t('public.home.processTitle')}
                </h2>
                <p className="m-0 text-[16.5px] leading-relaxed text-[#5E6E76] dark:text-[#93A7AF]">
                  {t('public.home.processSub')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Phase 1 */}
              <div className="bg-white dark:bg-[#132530] border border-[#EBE3D9] dark:border-[#22404C] rounded-[20px] p-7 flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <span className="w-[38px] h-[38px] rounded-xl bg-[#EDE4D7] dark:bg-[rgba(143,196,186,0.14)] text-[#8A6E33] dark:text-[#8FC4BA] flex items-center justify-center shrink-0">
                    <FolderHeart className="w-[21px] h-[21px]" />
                  </span>
                  <span className="font-semibold text-sm tracking-[0.03em] text-[#12303F] dark:text-[#F2F6F5]">
                    {t('public.home.phase1Label')}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <b className="text-[15px] text-[#16262F] dark:text-white">{t('public.home.step1Title')}</b>
                  <p className="m-0 text-[14.5px] leading-relaxed text-[#5E6E76] dark:text-[#B7C9CF]">
                    {t('public.home.step1Text')}
                  </p>
                </div>
              </div>

              {/* Phase 2 — highlighted */}
              <div className="bg-[#163A52] rounded-[20px] p-7 flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <span className="w-[38px] h-[38px] rounded-xl bg-[rgba(143,196,186,0.18)] text-[#8FC4BA] flex items-center justify-center shrink-0">
                    <Stethoscope className="w-[21px] h-[21px]" />
                  </span>
                  <span className="font-semibold text-sm tracking-[0.03em] text-[#F2F6F5]">
                    {t('public.home.phase2Label')}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <b className="text-[15px] text-white">{t('public.home.step2Title')}</b>
                  <p className="m-0 text-[14.5px] leading-relaxed text-[#B7C9CF]">{t('public.home.step2Text')}</p>
                </div>
                <div
                  className="mt-auto border-t border-white/10 pt-4 text-[14.5px] leading-relaxed italic text-[#C9DBD7]"
                  style={{ fontFamily: "Newsreader, Georgia, serif" }}
                >
                  « {t('public.home.step2Quote')} »
                </div>
              </div>

              {/* Phase 3 */}
              <div className="bg-white dark:bg-[#132530] border border-[#EBE3D9] dark:border-[#22404C] rounded-[20px] p-7 flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <span className="w-[38px] h-[38px] rounded-xl bg-[#EAF1EE] dark:bg-[rgba(47,110,101,0.18)] text-[#2F6E65] dark:text-[#8FC4BA] flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-[21px] h-[21px]" />
                  </span>
                  <span className="font-semibold text-sm tracking-[0.03em] text-[#12303F] dark:text-[#F2F6F5]">
                    {t('public.home.phase3Label')}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <b className="text-[15px] text-[#16262F] dark:text-white">{t('public.home.step3Title')}</b>
                  <p className="m-0 text-[14.5px] leading-relaxed text-[#5E6E76] dark:text-[#B7C9CF]">
                    {t('public.home.step3Text')}
                  </p>
                </div>
                <div className="mt-auto bg-[#F6F0E7] dark:bg-[rgba(138,110,51,0.14)] rounded-2xl p-4 flex items-center gap-3">
                  <Clock className="w-[22px] h-[22px] text-[#8A6E33] dark:text-[#C9A85C] shrink-0" />
                  <span className="text-[13.5px] leading-snug text-[#5E6E76] dark:text-[#B7C9CF]">
                    <Trans i18nKey="public.home.delayNote" components={{ bold: <b className="text-[#16262F] dark:text-white" /> }} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Specialties ---------- */}
        <section className="px-4 md:px-10 py-16 md:py-20 bg-[#F3EDE4] dark:bg-[#132530] border-y border-[#EBE3D9] dark:border-[#22404C]" id="specialites">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex flex-col items-center gap-3 text-center mb-10">
              <span className="font-semibold text-xs tracking-[0.16em] uppercase text-[#3E8C81] dark:text-[#8FC4BA]">
                {t('public.home.specialtiesEyebrow')}
              </span>
              <h2
                className="m-0 text-[32px] md:text-[42px] leading-[1.12] tracking-[-0.015em] text-[#12303F] dark:text-[#F4F8F8]"
                style={{ fontFamily: "Newsreader, Georgia, serif" }}
              >
                {t('public.home.specialtiesTitle')}
              </h2>
              <p className="m-0 max-w-[620px] text-[16.5px] leading-relaxed text-[#5E6E76] dark:text-[#93A7AF]">
                {t('public.home.specialtiesSub')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {SPECIALTIES.map(({ icon: Icon, nameKey, subKey }) => (
                <div
                  key={nameKey}
                  className="bg-[#FBF7F2] dark:bg-[#0F1D26] border border-[#E4DACE] dark:border-[#22404C] rounded-2xl p-6 flex items-center gap-4"
                >
                  <span className="w-[46px] h-[46px] shrink-0 rounded-[13px] bg-[#EAF1EE] dark:bg-[rgba(47,110,101,0.18)] text-[#2F6E65] dark:text-[#8FC4BA] flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <b className="text-[17px] text-[#16262F] dark:text-white">{t(`public.home.${nameKey}`)}</b>
                    <span className="text-[13.5px] text-[#7A8890] dark:text-[#93A7AF]">{t(`public.home.${subKey}`)}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-7 text-center text-sm text-[#7A8890] dark:text-[#93A7AF]">
              {t('public.home.specialtiesFooterNote')}
            </p>
          </div>
        </section>

        {/* ---------- Testimonials ---------- */}
        <section className="px-4 md:px-10 py-16 md:py-20">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10">
              <div className="flex flex-col gap-3 max-w-[600px]">
                <span className="font-semibold text-xs tracking-[0.16em] uppercase text-[#3E8C81] dark:text-[#8FC4BA]">
                  {t('public.home.testimonialsEyebrow')}
                </span>
                <h2
                  className="m-0 text-[32px] md:text-[42px] leading-[1.12] tracking-[-0.015em] text-[#12303F] dark:text-[#F4F8F8]"
                  style={{ fontFamily: "Newsreader, Georgia, serif" }}
                >
                  {t(assezDeTemoignagesReels ? 'public.home.testimonialsTitle' : 'public.home.testimonialsExamplesTitle')}
                </h2>
                {/* Mention explicite tant qu'aucun témoignage réel n'est publié :
                    le visiteur doit savoir qu'il lit des situations types. */}
                {!assezDeTemoignagesReels && (
                  <p className="m-0 text-[15px] leading-relaxed text-[#5E6E76] dark:text-[#93A7AF]">
                    {t('public.home.testimonialsExamplesNotice')}
                  </p>
                )}
              </div>
            </div>

            <Marquee duree={46} espacement={20}>
              {temoignagesAffiches.map((temoignage) => (
                <TestimonialCard key={temoignage.cle} temoignage={temoignage} t={t} />
              ))}
            </Marquee>
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="px-4 md:px-10 py-14 bg-[#EDE4D7] dark:bg-[#132530] flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col gap-2.5 max-w-[640px] text-center md:text-left">
            <h2 className="m-0 text-[28px] md:text-[36px] leading-[1.15] text-[#12303F] dark:text-[#F4F8F8]" style={{ fontFamily: "Newsreader, Georgia, serif" }}>
              {t('public.home.finalCtaTitle')}
            </h2>
            <p className="m-0 text-[16.5px] leading-relaxed text-[#5E6E76] dark:text-[#93A7AF]">
              {t('public.home.finalCtaText')}
            </p>
          </div>
          <Link
            to="/inscription"
            className="shrink-0 inline-flex items-center gap-2 bg-[#163A52] dark:bg-[#8FC4BA] text-white dark:text-[#0F2C38] rounded-full px-8 py-[18px] font-bold text-sm tracking-wide shadow-[0_12px_26px_-12px_rgba(22,58,82,0.6)] hover:opacity-90 transition-opacity"
          >
            {t('public.home.heroPrimaryCta')}
            <ArrowRight className="w-[19px] h-[19px]" />
          </Link>
        </section>

        {/* ---------- Footer ---------- */}
        <footer className="bg-[#12303F] text-[#B7C9CF] px-4 md:px-10 pt-14 pb-8">
          <div className="max-w-[1200px] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10 pb-9 border-b border-white/10">
              <div className="flex flex-col gap-3.5">
                <Logo light size={38} />
                <p className="m-0 max-w-[320px] text-sm leading-relaxed text-[#9FB6BD]">{t('public.footer.tagline')}</p>
              </div>
              <div className="flex flex-col gap-2.5">
                <b className="text-xs tracking-[0.14em] uppercase text-white">{t('public.footer.colPatients')}</b>
                <a href="/#fonctionnement" className="text-[#9FB6BD] text-sm hover:text-white transition-colors">{t('nav.howItWorks')}</a>
                <a href="/#specialites" className="text-[#9FB6BD] text-sm hover:text-white transition-colors">{t('nav.specialties')}</a>
                <span className="text-[#9FB6BD] text-sm">{t('public.footer.linkPricing')}</span>
                <span className="text-[#9FB6BD] text-sm">{t('public.footer.linkFaq')}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                <b className="text-xs tracking-[0.14em] uppercase text-white">{t('public.footer.colProfessionals')}</b>
                <Link to="/pour-medecins" className="text-[#9FB6BD] text-sm hover:text-white transition-colors">{t('public.footer.linkLocalDoctors')}</Link>
                <span className="text-[#9FB6BD] text-sm">{t('public.footer.linkInternationalSpecialists')}</span>
                <span className="text-[#9FB6BD] text-sm">{t('public.footer.linkInstitutions')}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                <b className="text-xs tracking-[0.14em] uppercase text-white">{t('public.footer.colTrust')}</b>
                <span className="text-[#9FB6BD] text-sm">{t('public.footer.linkDataProtection')}</span>
                <span className="text-[#9FB6BD] text-sm">{t('public.footer.linkConsent')}</span>
                <span className="text-[#9FB6BD] text-sm">{t('public.footer.linkLegal')}</span>
                <span className="text-[#9FB6BD] text-sm">{t('public.footer.linkContact')}</span>
              </div>
            </div>
            <div className="pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12.5px] text-[#7E959C]">
              <span>© {new Date().getFullYear()} {t('public.footer.copyright')}</span>
              <span>{t('public.footer.disclaimer')}</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
