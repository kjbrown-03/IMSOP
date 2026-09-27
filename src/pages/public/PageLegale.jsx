import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import Navbar from '../../components/layout/Navbar'

/**
 * Gabarit commun aux pages légales.
 *
 * Les trois pages — confidentialité, conditions d'utilisation, mentions
 * légales — ne diffèrent que par leur contenu. Un gabarit partagé garantit
 * qu'une correction de mise en page les touche toutes, et surtout que le
 * bandeau d'avertissement ne puisse pas être oublié sur l'une d'elles.
 *
 * `sections` est une liste de `{ titre, blocs }`, où chaque bloc est soit un
 * paragraphe (chaîne), soit une liste (tableau de chaînes).
 */
export default function PageLegale({ titre, chapeau, majLe, sections }) {
  const { t } = useTranslation()

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text-main)] antialiased font-body-md min-h-screen transition-colors duration-300">
      <Navbar />
      <main className="pt-16 pb-28 md:pb-16">
        <section className="w-full py-14 px-margin-mobile md:px-margin-desktop bg-[var(--color-surface)] border-b border-[var(--color-border)]">
          <div className="max-w-[820px] mx-auto">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors mb-5"
            >
              <ArrowLeft className="w-4 h-4" /> {t('common.backHome')}
            </Link>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-[var(--color-primary)]">
              {titre}
            </h1>
            <p className="font-body-lg text-body-lg text-[var(--color-text-secondary)] mt-4">{chapeau}</p>
            <p className="font-label-sm text-label-sm text-[var(--color-text-secondary)] mt-4">
              {t('legal.majLe', { date: majLe })}
            </p>
          </div>
        </section>

        <section className="w-full py-12 px-margin-mobile md:px-margin-desktop">
          <div className="max-w-[820px] mx-auto flex flex-col gap-10">
            {sections.map((s, i) => (
              <article key={i} className="flex flex-col gap-3">
                <h2 className="font-headline-md text-headline-md-mobile md:text-headline-md text-[var(--color-heading)]">
                  {s.titre}
                </h2>
                {s.blocs.map((bloc, j) =>
                  Array.isArray(bloc) ? (
                    <ul key={j} className="flex flex-col gap-2 pl-5 list-disc marker:text-[var(--color-primary)]">
                      {bloc.map((item, k) => (
                        <li key={k} className="font-body-md text-body-md text-[var(--color-text-secondary)]">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p key={j} className="font-body-md text-body-md text-[var(--color-text-secondary)] leading-relaxed">
                      {bloc}
                    </p>
                  ),
                )}
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
