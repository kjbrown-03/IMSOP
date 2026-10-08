import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Leaf, Stethoscope } from 'lucide-react'
import Navbar from '../../components/layout/Navbar'

/**
 * Premier pas de la recherche d'un praticien proche : conventionnel ou
 * traditionnel.
 *
 * Le choix est demandé AVANT la description des symptômes, pas après. Les deux
 * pratiques ne se mélangent pas dans une liste de résultats : un patient qui
 * cherche un tradipraticien ne cherche pas un cardiologue, et l'inverse est
 * tout aussi vrai. Poser la question d'abord évite de lui faire décrire son cas
 * pour lui répondre à côté.
 *
 * Chaque voie conduit ensuite à son propre formulaire, dont le vocabulaire
 * diffère — on ne décrit pas une consultation de la même façon des deux côtés.
 */
const VOIES = [
  {
    cle: 'CONVENTIONNEL',
    chemin: '/annuaire/conventionnel',
    icone: Stethoscope,
    ton: 'text-[var(--color-primary)]',
    fond: 'bg-[var(--color-primary)]/10',
  },
  {
    cle: 'TRADITIONNEL',
    chemin: '/annuaire/traditionnel',
    icone: Leaf,
    ton: 'text-emerald-600 dark:text-emerald-400',
    fond: 'bg-emerald-500/10',
  },
]

export default function AnnuaireChoix() {
  const { t } = useTranslation()

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text-main)] antialiased font-body-md min-h-screen transition-colors duration-300">
      <Navbar />
      <main className="pt-16 pb-28 md:pb-16">
        <section className="w-full py-14 px-margin-mobile md:px-margin-desktop bg-[var(--color-surface)] border-b border-[var(--color-border)]">
          <div className="max-w-[760px] mx-auto text-center">
            <span className="font-label-sm text-label-sm text-[var(--color-primary)] uppercase tracking-wider">
              {t('annuaire.choix.eyebrow')}
            </span>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-[var(--color-primary)] mt-2">
              {t('annuaire.choix.titre')}
            </h1>
            <p className="font-body-lg text-body-lg text-[var(--color-text-secondary)] mt-4">
              {t('annuaire.choix.intro')}
            </p>
          </div>
        </section>

        <section className="w-full py-12 px-margin-mobile md:px-margin-desktop">
          <div className="max-w-[900px] mx-auto grid gap-5 md:grid-cols-2">
            {VOIES.map(({ cle, chemin, icone: Icone, ton, fond }) => (
              <Link
                key={cle}
                to={chemin}
                className="group flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 hover:border-[var(--color-primary)] hover:shadow-lg transition-all"
              >
                <span className={`w-14 h-14 rounded-2xl ${fond} ${ton} flex items-center justify-center`}>
                  <Icone className="w-7 h-7" />
                </span>
                <div className="flex flex-col gap-2">
                  <h2 className="font-headline-md text-headline-md-mobile md:text-headline-md text-[var(--color-heading)]">
                    {t(`annuaire.choix.${cle}.titre`)}
                  </h2>
                  <p className="font-body-md text-body-md text-[var(--color-text-secondary)] leading-relaxed">
                    {t(`annuaire.choix.${cle}.description`)}
                  </p>
                </div>
                <span className={`mt-auto inline-flex items-center gap-1.5 font-label-md text-label-md ${ton}`}>
                  {t(`annuaire.choix.${cle}.action`)}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            ))}
          </div>

          <p className="max-w-[900px] mx-auto mt-8 font-body-sm text-body-sm text-[var(--color-text-secondary)] text-center">
            {t('annuaire.choix.note')}
          </p>
        </section>
      </main>
    </div>
  )
}
