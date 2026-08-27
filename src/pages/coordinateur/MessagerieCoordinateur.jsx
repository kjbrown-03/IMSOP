import { SidebarProvider } from '../../components/blocks/sidebar'
import { Home } from '../../components/blocks/chat-template'

export default function MessagerieCoordinateur() {
  return (
    <SidebarProvider>
      <Home />
    </SidebarProvider>
  )
}
