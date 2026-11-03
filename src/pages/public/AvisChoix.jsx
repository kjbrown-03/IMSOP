import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Globe2, MapPin } from 'lucide-react'
import Navbar from '../../components/layout/Navbar'

/**
 * Premier pas de « Demander un avis » : international ou local.
 *
 * Les deux voies ne se ressemblent pas, et c'est pour ça qu'il faut choisir
 * avant de commencer.
 *
 * L'avis INTERNATIONAL est le cœur d'IMSOP : on dépose un dossier avec ses
 * documents, un spécialiste étranger l'étudie, et un rapport écrit revient
 * quelques jours plus tard. On ne rencontre personne.
 *
 * L'avis LOCAL est l'inverse : on cherche un praticien près de chez soi pour
 * aller le voir. C'est l'annuaire. Rien à déposer, rien à attendre — un nom,
 * un numéro, une adresse.
 *
 * Mener les deux au même formulaire aurait été plus simple à écrire et plus
 * décevant à l'usage : un patient qui veut voir quelqu'un demain n'a pas à
 * remplir un dossier de deuxième avis pour s'apercevoir que la réponse met
 * cinq jours.
 */
const VOIES = [
  {
    cle: 'LOCAL',
    chemin: '/annuaire',
    icone: MapPin,
    ton: 'text-[var(--color-primary)]',
    fond: 'bg-[var(--color-primary)]/10',
  },
  {
    cle: 'INTERNATIONAL',
    chemin: '/inscription',
    icone: Globe2,
    ton: 'text-emerald-600 dark:text-emerald-400',
    fond: 'bg-emerald-500/10',
  },
]

export default function AvisChoix() {
  const { t } = useTranslation()

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text-main)] antialiased font-body-md min-h-screen transition-colors duration-300">
      <Navbar />
      <main className="pt-16 pb-28 md:pb-16">
        <section className="w-full py-14 px-margin-mobile md:px-margin-desktop bg-[var(--color-surface)] border-b border-[var(--color-border)]">
          <div className="max-w-[760px] mx-auto text-center">
            <span className="font-label-sm text-label-sm text-[var(--color-primary)] uppercase tracking-wider">
              {t('avis.choix.eyebrow')}
            </span>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-[var(--color-primary)] mt-2">
              {t('avis.choix.titre')}
            </h1>
            <p className="font-body-lg text-body-lg text-[var(--color-text-secondary)] mt-4">
              {t('avis.choix.intro')}
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
                    {t(`avis.choix.${cle}.titre`)}
                  </h2>
                  <p className="font-body-md text-body-md text-[var(--color-text-secondary)] leading-relaxed">
                    {t(`avis.choix.${cle}.description`)}
                  </p>
                  {/* Le delai et ce qu'on obtient, dits ici plutot que decouverts
                      a la fin : c'est ce qui separe vraiment les deux voies. */}
                  <p className="font-label-sm text-label-sm text-[var(--color-text-secondary)] mt-1">
                    {t(`avis.choix.${cle}.delai`)}
                  </p>
                </div>
                <span className={`mt-auto inline-flex items-center gap-1.5 font-label-md text-label-md ${ton}`}>
                  {t(`avis.choix.${cle}.action`)}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            ))}
          </div>

          <p className="max-w-[900px] mx-auto mt-8 font-body-sm text-body-sm text-[var(--color-text-secondary)] text-center">
            {t('avis.choix.note')}
          </p>
        </section>
      </main>
    </div>
  )
}
