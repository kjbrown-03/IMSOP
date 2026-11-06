import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ComplementDemande, { ReponseComplement } from './ComplementDemande'
import { api } from '../../lib/api'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (cle) => cle }) }))
vi.mock('../../lib/api', () => ({ api: { post: vi.fn() } }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const DOSSIER = { id: 'd1', status: 'INFORMATION_COMPLEMENTAIRE_DEMANDEE', complementPrecisions: 'Date de la dernière chimiothérapie ?' }

describe('ComplementDemande', () => {
  let hote
  let racine

  beforeEach(() => {
    vi.clearAllMocks()
    hote = document.createElement('div')
    document.body.appendChild(hote)
    racine = createRoot(hote)
  })

  afterEach(() => {
    act(() => racine.unmount())
    hote.remove()
  })

  const boutonEnvoyer = () => [...hote.querySelectorAll('button')].find((b) => b.textContent.includes('complement.envoyer'))

  function saisir(valeur) {
    const zone = hote.querySelector('textarea')
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    act(() => {
      setter.call(zone, valeur)
      zone.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('affiche la demande, et ne permet pas de répondre sans rien envoyer', () => {
    act(() => racine.render(<ComplementDemande dossier={DOSSIER} onRepondu={() => {}} />))
    expect(hote.textContent).toContain(DOSSIER.complementPrecisions)
    expect(boutonEnvoyer().disabled).toBe(true)
    saisir('   ')
    expect(boutonEnvoyer().disabled).toBe(true)
  })

  it('envoie la réponse écrite et rend le dossier mis à jour', async () => {
    api.post.mockResolvedValue({ data: { id: 'd1', status: 'EN_ANALYSE' } })
    const onRepondu = vi.fn()
    act(() => racine.render(<ComplementDemande dossier={DOSSIER} onRepondu={onRepondu} />))
    saisir('En mars 2026.')
    await act(async () => boutonEnvoyer().click())
    expect(api.post).toHaveBeenCalledWith('/dossiers/d1/complement-fourni', { reponse: 'En mars 2026.' })
    expect(onRepondu).toHaveBeenCalledWith({ id: 'd1', status: 'EN_ANALYSE' })
  })

  it("dit l'échec au lieu de faire croire que la réponse est partie", async () => {
    api.post.mockRejectedValue(new Error('réseau'))
    const onRepondu = vi.fn()
    act(() => racine.render(<ComplementDemande dossier={DOSSIER} onRepondu={onRepondu} />))
    saisir('En mars 2026.')
    await act(async () => boutonEnvoyer().click())
    expect(onRepondu).not.toHaveBeenCalled()
    expect(hote.querySelector('[role=alert]').textContent).toBe('complement.envoiEchoue')
  })

  it('le praticien ne voit la réponse que lorsque le complément est revenu', () => {
    act(() => racine.render(<ReponseComplement dossier={{ status: 'EN_ANALYSE', complementReponse: 'En mars 2026.' }} />))
    expect(hote.textContent).toContain('En mars 2026.')
    act(() => racine.render(<ReponseComplement dossier={{ status: 'EN_ANALYSE', complementReponse: null }} />))
    expect(hote.textContent).toBe('')
  })
})
