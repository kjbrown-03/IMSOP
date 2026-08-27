import { useState } from 'react'
import BasculeVisibilite from './BasculeVisibilite'

/**
 * Champ de mot de passe avec bascule d'affichage.
 *
 * Les écrans d'inscription et de réinitialisation avaient chacun leur balisage,
 * et un seul portait une bascule. Les styles restent propres à chaque écran (via
 * `className`), seule la mécanique est mutualisée.
 *
 * Le rembourrage droit est ajouté au `className` reçu pour que le texte saisi ne
 * passe pas sous l'icône.
 */
export default function ChampMotDePasse({ className = '', ...props }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className} pr-11`} />
      <BasculeVisibilite
        visible={visible}
        onToggle={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2"
      />
    </div>
  )
}
