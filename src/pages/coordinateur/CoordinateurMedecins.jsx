import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CoordinatorLayout from '../../components/layout/CoordinatorLayout'
import AdminUserManager from '../../components/admin/AdminUserManager'

/**
 * Gestion des praticiens de proximité par la coordination.
 *
 * Le pendant de l'écran « Gestion des experts », pour l'autre moitié du réseau.
 * Elle n'existait pas : un médecin traitant recruté depuis une candidature ne
 * pouvait plus être ni corrigé ni suspendu ensuite, faute d'écran — alors que
 * c'est le même métier que pour un spécialiste.
 *
 * Médecins et tradipraticiens ont deux rôles distincts : deux listes, jamais
 * mélangées, comme dans l'annuaire.
 *
 * L'habilitation n'est pas pilotée d'ici : créer un compte ne vaut pas
 * validation (CDC §16), le contrôle du numéro d'ordre reste sur l'écran
 * Habilitations.
 */
export default function CoordinateurMedecins() {
  const { t } = useTranslation()
  const [role, setRole] = useState('MEDECIN_LOCAL')
  return (
    <CoordinatorLayout>
      <div className="flex gap-2" role="tablist">
        {['MEDECIN_LOCAL', 'TRADIPRATICIEN'].map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={role === r}
            onClick={() => setRole(r)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              role === r
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300'
            }`}
          >
            {t(`admin.praticiensOnglets.${r}`)}
          </button>
        ))}
      </div>
      {/* `key` : changer d'onglet repart d'un état vierge (formulaire, recherche). */}
      <AdminUserManager key={role} role={role} />
    </CoordinatorLayout>
  )
}
