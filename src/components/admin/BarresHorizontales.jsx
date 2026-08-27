import { useTranslation } from 'react-i18next'

/**
 * Barres horizontales, une seule série.
 *
 * Horizontal parce que les libellés sont des noms de spécialité, de pays ou de
 * praticien : en vertical ils s'inclinent ou se tronquent. Une seule série, donc
 * pas de légende — le titre de la section nomme la mesure — et chaque barre porte
 * directement sa valeur : le lecteur n'a jamais à viser un axe.
 *
 * La couleur (#2a78d6 / #3987e5) est celle du créneau catégoriel 1 de la palette
 * de référence, validée sur les deux surfaces : bandes de clarté, plancher de
 * chroma et contrainte de contraste >= 3:1 tous PASS.
 */
export default function BarresHorizontales({ donnees, formater, suffixe = '' }) {
  const { i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const formaterValeur = formater || ((v) => v.toLocaleString(locale))

  if (!donnees?.length) return null

  const max = Math.max(...donnees.map((d) => d.valeur ?? 0), 0)

  return (
    <div
      className="flex flex-col gap-2.5"
      style={{ '--serie-1': '#2a78d6' }}
    >
      <style>{`
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) .viz-barres { --serie-1: #3987e5; }
        }
        :root[data-theme="dark"] .viz-barres { --serie-1: #3987e5; }
      `}</style>
      {donnees.map((d) => {
        const largeur = max > 0 ? Math.max((d.valeur / max) * 100, 1.5) : 0
        return (
          <div key={d.libelle} className="viz-barres grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
            <span
              className="text-xs text-slate-600 dark:text-neutral-300 truncate"
              title={d.libelle}
            >
              {d.libelle}
            </span>
            {/* Piste creuse récessive : elle situe la barre sans concurrencer la donnée. */}
            <span className="h-2.5 rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden">
              <span
                className="block h-full rounded-full"
                style={{ width: `${largeur}%`, backgroundColor: 'var(--serie-1)' }}
              />
            </span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white tabular-nums">
              {formaterValeur(d.valeur)}
              {suffixe}
            </span>
          </div>
        )
      })}
    </div>
  )
}
