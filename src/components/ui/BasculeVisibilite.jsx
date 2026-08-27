import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Le bouton œil, partagé par tous les champs de mot de passe.
 *
 * Isolé pour que l'icône, l'intitulé accessible et le comportement soient
 * strictement identiques partout — la page de connexion utilise `AppInput`, les
 * autres écrans `ChampMotDePasse`, mais l'utilisateur doit voir la même chose.
 *
 * `type="button"` est indispensable : sans lui, un bouton dans un formulaire le
 * soumet, et cliquer sur l'œil enverrait le formulaire.
 */
export default function BasculeVisibilite({ visible, onToggle, className = '' }) {
  const { t } = useTranslation()
  const Icone = visible ? EyeOff : Eye
  const intitule = t(visible ? 'common.hidePassword' : 'common.showPassword')

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={intitule}
      title={intitule}
      className={`text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${className}`}
    >
      <Icone className="w-5 h-5" strokeWidth={2} />
    </button>
  )
}
