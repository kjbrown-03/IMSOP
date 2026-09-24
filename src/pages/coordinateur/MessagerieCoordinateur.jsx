import CoordinatorLayout from '../../components/layout/CoordinatorLayout'
import { SidebarProvider } from '../../components/blocks/sidebar'
import { Home } from '../../components/blocks/chat-template'

/**
 * Messagerie dans la coquille coordinateur, comme tous les autres onglets.
 *
 * Le composant de messagerie sait rendre sa propre barre latérale ; ici on la
 * désactive, la coquille apportant déjà la navigation, l'en-tête et les mêmes
 * effets que partout ailleurs. Le SidebarProvider reste nécessaire : le
 * composant lit son contexte même quand la barre n'est pas rendue.
 */
export default function MessagerieCoordinateur() {
  return (
    <CoordinatorLayout pleinEcran>
      <SidebarProvider className="min-h-0 h-full">
        <Home avecBarreLaterale={false} />
      </SidebarProvider>
    </CoordinatorLayout>
  )
}
