import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useIsMobile } from '@/components/hooks/use-mobile'
import { LIENS_COORDINATEUR } from '@/lib/navigationCoordinateur'

import {
  SidebarInset,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/blocks/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import {
  ChevronLeft,
  ChevronUp,
  FolderOpen,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Stethoscope,
  User,
  User2,
  Video,
  X,
} from 'lucide-react'

import { api } from '@/lib/api'
import { getCallSocket } from '@/lib/socket'
import { useAuthStore } from '@/store/useAuthStore'
import { useNotificationStore } from '@/store/useNotificationStore'
import MessageAttachment, { formatSize } from '@/components/ui/MessageAttachment'

// Mirrors backend/src/middleware/upload.js — matching it here turns an
// oversized or wrong-format file into an instant message instead of a wasted
// upload over a mobile link.
const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'application/dicom']
const MAX_BYTES = 25 * 1024 * 1024

// No TURN server: this simplified calling feature works peer-to-peer over
// STUN alone, which covers most home/office networks but can fail behind
// restrictive corporate NATs. Adding TURN is a later, infra-level upgrade.
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

// `avecBarreLaterale` : la page rend sa propre barre latérale quand elle est
// affichée seule. Insérée dans la coquille d'un rôle, celle-ci fournit déjà la
// navigation — en rendre une seconde donnait un écran différent des autres
// onglets (autre style, autres effets au survol, autre position).
export const Home = ({ avecBarreLaterale = true }) => {
  const { toggleSidebar } = useSidebar()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { id: urlDossierId } = useParams()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const markReadByDossier = useNotificationStore((s) => s.markReadByDossier)
  // The secure messaging thread is coordination ↔ specialist only (the
  // patient and the médecin local no longer have a conversation view at
  // all - see dossiers.controller.js's poserQuestionMedecinLocal for how
  // the médecin local's side of this works instead).
  const isCoordinateur = user?.role === 'COORDINATEUR' || user?.role === 'ADMIN'
  const basePath = isCoordinateur ? '/coordinateur/messages' : '/specialiste/messagerie'

  // Cette page a sa propre barre latérale, hors des coquilles habituelles.
  // Côté coordinateur elle rend la liste partagée : une copie locale de deux
  // entrées faisait disparaître tous les autres onglets dès qu'on ouvrait la
  // messagerie.
  const navItems = isCoordinateur
    ? LIENS_COORDINATEUR.map(({ to, cle, icone }) => ({
        to,
        label: t(`shell.coordinatorNav.${cle}`),
        icon: icone,
        active: to === basePath,
      }))
    : [
        { to: '/specialiste/tableau-de-bord', label: t('shell.specialistNav.dossiers'), icon: LayoutDashboard },
        { to: basePath, label: t('shell.specialistNav.messages'), icon: MessageCircle, active: true },
        { to: '/specialiste/disponibilites', label: t('shell.specialistNav.compte'), icon: User },
      ]

  const [contacts, setContacts] = useState([])
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [contactsError, setContactsError] = useState(null)
  const [search, setSearch] = useState('')
  const [activeDossierId, setActiveDossierId] = useState(urlDossierId || null)

  // Discussions directes, sans dossier. La liste des contacts se deduisait
  // uniquement de GET /dossiers : un praticien fraichement recrute, a qui rien
  // n'est encore affecte, n'apparaissait donc nulle part.
  const [discussions, setDiscussions] = useState([])
  const [activeDiscussionId, setActiveDiscussionId] = useState(null)
  // Resultats de la recherche de praticiens a qui la coordination peut ecrire,
  // pour demarrer un fil qui n'existe pas encore.
  const [destinataires, setDestinataires] = useState([])
  const [ouvertureEnCours, setOuvertureEnCours] = useState(null)

  const [messages, setMessages] = useState([])
  const [messagingClosesAt, setMessagingClosesAt] = useState(null)
  const [loadingThread, setLoadingThread] = useState(false)
  const [threadError, setThreadError] = useState(null)

  const [threadSearchOpen, setThreadSearchOpen] = useState(false)
  const [threadSearchQuery, setThreadSearchQuery] = useState('')

  const [callStatus, setCallStatus] = useState('idle') // idle | calling | ringing | connecting | in-call
  const [incomingCall, setIncomingCall] = useState(null)
  const [callError, setCallError] = useState(null)
  const inviteTimeoutRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteStreamRef = useRef(null)
  // Candidats ICE arrives avant la description distante : les poser tout de
  // suite leve InvalidStateError et le candidat est perdu, ce qui peut suffire
  // a empecher la connexion de s'etablir.
  const pendingCandidatesRef = useRef([])
  // Les signaux arrivent en rafale et leur traitement est asynchrone : sans
  // file, un candidat pouvait etre traite pendant qu'un setRemoteDescription
  // etait encore en cours.
  const signalQueueRef = useRef(Promise.resolve())
  // Incremente a chaque changement de flux, pour rebrancher les <video>.
  const [mediaVersion, setMediaVersion] = useState(0)
  const localStreamRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const callPeerUserIdRef = useRef(null)
  const callDossierIdRef = useRef(null)

  // Sous 768px les deux panneaux ne tiennent pas cote a cote : on montre la
  // liste, ou la conversation, jamais les deux.
  const estMobile = useIsMobile()

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)
  const bottomRef = useRef(null)

  // A coordinateur's counterpart is the real specialist assigned to that
  // dossier. A specialist has no single named counterpart - any
  // coordinateur/admin can be handling the thread - so they get a fixed
  // pseudo-contact standing in for the coordination team. It has no real
  // user id, which is also what disables the video-call button for it below:
  // there's no one specific person to ring.
  const COORDINATION_CONTACT = { id: null, fullName: t('chat.coordinationTeam'), avatarUrl: null }

  function counterpartOf(dossier) {
    // GET /dossiers already scopes a specialist's list to their own
    // assignments, so every dossier here is relevant - unlike the
    // coordinateur side, no per-dossier check is needed.
    if (isCoordinateur) return dossier.specialiste?.user || null
    return COORDINATION_CONTACT
  }

  function formatListTime(iso) {
    const date = new Date(iso)
    const now = new Date()
    const sameDay = date.toDateString() === now.toDateString()
    const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
    if (sameDay) return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' })
  }

  // A conversation opens as soon as the counterpart is set on the dossier
  // (patient's specialiste, or specialist's patient) — same rule as the
  // patient's own message list.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingContacts(true)
      try {
        const { data } = await api.get('/dossiers')
        const withCounterpart = data.items.filter((d) => counterpartOf(d))
        const withLastMessage = await Promise.all(
          withCounterpart.map(async (d) => {
            try {
              const { data: msgData } = await api.get(`/dossiers/${d.id}/messages`)
              return { dossier: d, last: msgData.messages[msgData.messages.length - 1] || null }
            } catch {
              return { dossier: d, last: null }
            }
          }),
        )
        if (cancelled) return
        setContacts(withLastMessage)
        // Ouvrir d'office le premier dossier affichait un correspondant avec
        // qui rien n'a jamais ete echange. On n'ouvre que si une conversation
        // existe reellement.
        // Sur mobile, ouvrir d'office une conversation ferait arriver dans un
        // fil sans jamais avoir vu la liste.
        if (!estMobile) {
          setActiveDossierId((prev) => prev ?? withLastMessage.find((c) => c.last)?.dossier.id ?? null)
        }
      } catch (err) {
        if (!cancelled) setContactsError(err.response?.data?.message || t('errors.loadMessagesFailed'))
      } finally {
        if (!cancelled) setLoadingContacts(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCoordinateur, t])

  // Les discussions directes vivent a cote des dossiers dans la meme liste.
  const [rechargerDiscussions, setRechargerDiscussions] = useState(0)
  useEffect(() => {
    let annule = false
    api.get('/conversations')
      .then(({ data }) => { if (!annule) setDiscussions(data.conversations) })
      .catch(() => { /* la liste des dossiers reste utilisable sans elles */ })
    return () => { annule = true }
  }, [rechargerDiscussions])

  // La recherche interroge aussi les praticiens joignables : c'est le seul
  // moyen d'atteindre quelqu'un avec qui aucun fil n'existe encore.
  useEffect(() => {
    if (!isCoordinateur || search.trim().length < 2) {
      setDestinataires([])
      return
    }
    let annule = false
    const minuteur = setTimeout(() => {
      api.get('/conversations/destinataires', { params: { q: search.trim() } })
        .then(({ data }) => { if (!annule) setDestinataires(data.utilisateurs) })
        .catch(() => { if (!annule) setDestinataires([]) })
    }, 250)
    return () => { annule = true; clearTimeout(minuteur) }
  }, [isCoordinateur, search])

  useEffect(() => {
    setThreadSearchOpen(false)
    setThreadSearchQuery('')
  }, [activeDossierId, activeDiscussionId])

  // Messages d'une discussion directe. Volontairement separe du chargement des
  // fils de dossiers : les deux n'ont ni la meme route ni la meme fermeture.
  useEffect(() => {
    if (!activeDiscussionId) return
    let annule = false
    async function charger() {
      setLoadingThread(true)
      setThreadError(null)
      try {
        const { data } = await api.get(`/conversations/${activeDiscussionId}/messages`)
        if (annule) return
        setMessages(data.messages)
        setMessagingClosesAt(null)
      } catch (err) {
        if (!annule) setThreadError(err.response?.data?.message || t('errors.conversationNotFound'))
      } finally {
        if (!annule) setLoadingThread(false)
      }
    }
    charger()
    return () => { annule = true }
  }, [activeDiscussionId, t])

  useEffect(() => {
    if (!activeDossierId) return
    let cancelled = false
    async function load() {
      setLoadingThread(true)
      setThreadError(null)
      try {
        const { data } = await api.get(`/dossiers/${activeDossierId}/messages`)
        if (cancelled) return
        setMessages(data.messages)
        setMessagingClosesAt(data.messagingClosesAt)
        markReadByDossier(activeDossierId)
      } catch (err) {
        if (!cancelled) setThreadError(err.response?.data?.message || t('errors.conversationNotFound'))
      } finally {
        if (!cancelled) setLoadingThread(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [activeDossierId, t])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const activeContact = contacts.find((c) => c.dossier.id === activeDossierId)
  const activeDiscussion = discussions.find((d) => d.id === activeDiscussionId)
  // Une discussion directe n'a pas de dossier : ni piece jointe (elle irait
  // dans le dossier de qui ?), ni appel video (l'autorisation d'appel se lit
  // sur un dossier partage).
  const filEstDiscussion = Boolean(activeDiscussionId)
  const activeCounterpart = filEstDiscussion
    ? activeDiscussion?.correspondant || null
    : activeContact
      ? counterpartOf(activeContact.dossier)
      : null
  const activeSubtitle = filEstDiscussion
    ? t('chat.discussionDirecte')
    : activeContact
      ? isCoordinateur
        ? activeContact.dossier.specialiste?.specialite
        : t('chat.patientFile')
      : ''
  const closed = messagingClosesAt && new Date(messagingClosesAt) < new Date()

  const rechercheActive = search.trim().length > 0

  // Une messagerie s'ouvre des qu'un correspondant est rattache au dossier,
  // mais tant que personne n'a ecrit il n'y a rien a montrer : la liste
  // repetait le meme correspondant autant de fois qu'il avait de dossiers,
  // sans qu'aucun echange n'existe. On n'affiche donc que les conversations
  // reellement engagees. Les autres restent joignables par la recherche, qui
  // est le point d'entree pour demarrer un echange, et celle qui est ouverte
  // reste visible tant qu'elle l'est.
  const filteredContacts = contacts.filter(({ dossier, last }) => {
    const q = search.trim().toLowerCase()
    if (!q) return Boolean(last) || dossier.id === activeDossierId
    return [
      counterpartOf(dossier)?.fullName,
      dossier.specialiteRequise,
      dossier.specialiste?.specialite,
      dossier.reference,
      dossier.motif,
    ].some((champ) => champ?.toLowerCase().includes(q))
  })

  // Une discussion ouverte reste visible meme sans message, sinon on tomberait
  // dans un fil qui n'apparait plus dans la liste d'a cote.
  const discussionsFiltrees = discussions.filter((d) => {
    const q = search.trim().toLowerCase()
    if (!q) return Boolean(d.dernierMessage) || d.id === activeDiscussionId
    return d.correspondant?.fullName?.toLowerCase().includes(q)
  })

  // Les praticiens deja joignables par un fil existant n'ont pas a reapparaitre
  // sous « demarrer une discussion ».
  const dejaEnDiscussion = new Set(discussions.map((d) => d.correspondant?.id))
  const destinatairesNouveaux = destinataires.filter((u) => !dejaEnDiscussion.has(u.id))

  const visibleMessages = threadSearchQuery.trim()
    ? messages.filter((m) => m.body?.toLowerCase().includes(threadSearchQuery.trim().toLowerCase()))
    : messages

  function highlightQuery(text) {
    if (!threadSearchQuery.trim()) return text
    const query = threadSearchQuery.trim()
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-300/70 text-inherit rounded-sm px-0.5">
          {part}
        </mark>
      ) : (
        part
      ),
    )
  }

  function patchContactPreview(dossierId, message) {
    setContacts((prev) => prev.map((c) => (c.dossier.id === dossierId ? { ...c, last: message } : c)))
  }

  function patchDiscussionPreview(id, message) {
    setDiscussions((prev) => prev.map((d) => (d.id === id ? { ...d, dernierMessage: message } : d)))
  }

  // Keeps the URL in sync with the open conversation so it stays a valid deep
  // link (NotificationBell points straight at /patient/messages/:id) and the
  // browser back/forward buttons behave.
  // Sur mobile, quitter la conversation revient a la liste : sans ca, le fil
  // occupe tout l'ecran et rien ne permet d'en changer.
  function retourListe() {
    setActiveDossierId(null)
    setActiveDiscussionId(null)
    navigate(basePath, { replace: true })
  }

  function selectContact(dossierId) {
    setActiveDiscussionId(null)
    setActiveDossierId(dossierId)
    navigate(`${basePath}/${dossierId}`, { replace: true })
  }

  function ouvrirDiscussion(id) {
    setActiveDossierId(null)
    setActiveDiscussionId(id)
    setMessages([])
    navigate(basePath, { replace: true })
  }

  // Demarrer un fil depuis un resultat de recherche. Le serveur est idempotent :
  // rechercher deux fois le meme nom ne cree pas deux discussions.
  async function demarrerDiscussion(utilisateur) {
    setOuvertureEnCours(utilisateur.id)
    try {
      const { data } = await api.post('/conversations', { destinataireId: utilisateur.id })
      setSearch('')
      setDestinataires([])
      setRechargerDiscussions((n) => n + 1)
      ouvrirDiscussion(data.id)
    } catch (err) {
      setContactsError(err.response?.data?.message || t('errors.loadMessagesFailed'))
    } finally {
      setOuvertureEnCours(null)
    }
  }

  function pickFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ACCEPTED_MIME.includes(file.type)) {
      setUploadError(t('chat.attachTypeError'))
      return
    }
    if (file.size > MAX_BYTES) {
      setUploadError(t('chat.attachSizeError'))
      return
    }
    setUploadError(null)
    setPendingFile(file)
  }

  async function sendAttachment() {
    if (!pendingFile || sending || !activeDossierId) return
    setSending(true)
    setUploadError(null)
    const form = new FormData()
    form.append('file', pendingFile)
    if (draft.trim()) form.append('body', draft.trim())
    try {
      const { data } = await api.post(`/dossiers/${activeDossierId}/messages/piece-jointe`, form)
      setMessages((prev) => [...prev, data])
      patchContactPreview(activeDossierId, data)
      setPendingFile(null)
      setDraft('')
    } catch (err) {
      setUploadError(err.response?.data?.message || t('chat.attachFailed'))
    } finally {
      setSending(false)
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (pendingFile) return sendAttachment()
    if (!draft.trim() || sending) return
    if (!activeDossierId && !activeDiscussionId) return

    setSending(true)
    try {
      // Deux routes pour deux natures de fil : un message de discussion
      // directe n'appartient a aucun dossier.
      const url = filEstDiscussion
        ? `/conversations/${activeDiscussionId}/messages`
        : `/dossiers/${activeDossierId}/messages`
      const { data } = await api.post(url, { body: draft.trim() })
      setMessages((prev) => [...prev, data])
      if (filEstDiscussion) patchDiscussionPreview(activeDiscussionId, data)
      else patchContactPreview(activeDossierId, data)
      setDraft('')
    } catch (err) {
      setThreadError(err.response?.data?.message || t('errors.sendMessageFailed'))
    } finally {
      setSending(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/')
  }

  // Les elements <video> n'existent pas encore au moment ou la camera s'ouvre :
  // ensureLocalStream est appelee alors que la fenetre d'appel n'est pas montee
  // - statut « idle » cote appelant, « ringing » cote appele. Attacher le flux a
  // sa creation ne pouvait donc pas fonctionner, d'ou un apercu local noir des
  // deux cotes. On (re)branche les deux flux des que les elements sont la, et a
  // chaque changement de flux.
  useEffect(() => {
    if (localVideoRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current
    }
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current
    }
  }, [callStatus, mediaVersion, incomingCall])

  function cleanupCall() {
    peerConnectionRef.current?.close()
    peerConnectionRef.current = null
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    remoteStreamRef.current = null
    pendingCandidatesRef.current = []
    signalQueueRef.current = Promise.resolve()
    // Sans ca, la derniere image du correspondant reste figee dans l'element
    // jusqu'a l'appel suivant.
    if (localVideoRef.current) localVideoRef.current.srcObject = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    callPeerUserIdRef.current = null
    callDossierIdRef.current = null
    setIncomingCall(null)
  }

  async function ensureLocalStream() {
    if (localStreamRef.current) return localStreamRef.current
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    localStreamRef.current = stream
    setMediaVersion((n) => n + 1)
    return stream
  }

  function createPeerConnection(peerUserId) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getCallSocket().emit('call:signal', { toUserId: peerUserId, data: { candidate: event.candidate } })
      }
    }
    pc.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0]
      setMediaVersion((n) => n + 1)
    }
    peerConnectionRef.current = pc
    return pc
  }

  async function startWebRTCOffer(peerUserId) {
    setCallStatus('connecting')
    const pc = createPeerConnection(peerUserId)
    const stream = localStreamRef.current
    stream.getTracks().forEach((track) => pc.addTrack(track, stream))
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    getCallSocket().emit('call:signal', { toUserId: peerUserId, data: { sdp: offer } })
    setCallStatus('in-call')
  }

  async function traiterSignal(fromUserId, data) {
    let pc = peerConnectionRef.current
    if (!pc) {
      // Callee side: the first signal we ever receive is the caller's offer.
      pc = createPeerConnection(fromUserId)
      const stream = await ensureLocalStream()
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))
    }
    if (data.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))

      // La description distante est posee : les candidats mis de cote peuvent
      // enfin etre appliques, dans leur ordre d'arrivee.
      const enAttente = pendingCandidatesRef.current
      pendingCandidatesRef.current = []
      for (const candidate of enAttente) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (err) {
          console.error('addIceCandidate (file) a echoue', err)
        }
      }

      if (data.sdp.type === 'offer') {
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        getCallSocket().emit('call:signal', { toUserId: fromUserId, data: { sdp: answer } })
      }
      setCallStatus('in-call')
    } else if (data.candidate) {
      if (!pc.remoteDescription) {
        pendingCandidatesRef.current.push(data.candidate)
        return
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
      } catch (err) {
        console.error('addIceCandidate a echoue', err)
      }
    }
  }

  // Les signaux sont traites un par un : deux attentes concurrentes pouvaient
  // sinon poser un candidat alors que la description distante n'etait pas
  // encore appliquee, et le perdre.
  function handleSignal(fromUserId, data) {
    signalQueueRef.current = signalQueueRef.current
      .then(() => traiterSignal(fromUserId, data))
      .catch((err) => console.error('traitement du signal a echoue', err))
  }

  async function startCall() {
    if (!activeCounterpart?.id || !activeDossierId || callStatus !== 'idle') return
    setCallError(null)
    try {
      await ensureLocalStream()
    } catch {
      setCallError(t('chat.cameraError'))
      return
    }
    callPeerUserIdRef.current = activeCounterpart.id
    callDossierIdRef.current = activeDossierId
    setCallStatus('calling')
    getCallSocket().emit('call:invite', { dossierId: activeDossierId, toUserId: activeCounterpart.id })

    // Sans cette limite, une invitation restée sans réponse laissait l'écran
    // sur « appel en cours » pour toujours.
    clearTimeout(inviteTimeoutRef.current)
    inviteTimeoutRef.current = setTimeout(() => {
      setCallError(t('chat.callNoAnswer'))
      cleanupCall()
      setCallStatus('idle')
    }, 30000)
  }

  async function acceptIncomingCall() {
    if (!incomingCall) return
    setCallError(null)
    try {
      await ensureLocalStream()
    } catch {
      setCallError(t('chat.cameraError'))
      declineIncomingCall()
      return
    }
    callPeerUserIdRef.current = incomingCall.fromUserId
    callDossierIdRef.current = incomingCall.dossierId
    selectContact(incomingCall.dossierId)
    setCallStatus('connecting')
    getCallSocket().emit('call:accept', { dossierId: incomingCall.dossierId, toUserId: incomingCall.fromUserId })
    setIncomingCall(null)
  }

  function declineIncomingCall() {
    if (incomingCall) {
      getCallSocket().emit('call:decline', { dossierId: incomingCall.dossierId, toUserId: incomingCall.fromUserId })
    }
    setIncomingCall(null)
    setCallStatus('idle')
  }

  function endCall() {
    if (callPeerUserIdRef.current) {
      getCallSocket().emit('call:end', { dossierId: callDossierIdRef.current, toUserId: callPeerUserIdRef.current })
    }
    cleanupCall()
    setCallStatus('idle')
  }

  useEffect(() => {
    // The connection itself lives at the App level for as long as the
    // session does (see App.jsx) — otherwise leaving this page (Dossiers,
    // Profil...) would drop it and make this user look unreachable to a
    // caller even while still logged in. Here we only attach/detach the
    // listeners this page cares about.
    const socket = getCallSocket()

    function onInvite({ dossierId, fromUserId, fromName }) {
      setIncomingCall({ dossierId, fromUserId, fromName })
      setCallStatus('ringing')
    }
    function onAccept({ fromUserId }) {
      clearTimeout(inviteTimeoutRef.current)
      startWebRTCOffer(fromUserId)
    }
    function onRejected({ motif }) {
      clearTimeout(inviteTimeoutRef.current)
      setCallError(t(motif === 'NON_AUTORISE' ? 'chat.callNotAllowed' : 'chat.callFailed'))
      cleanupCall()
      setCallStatus('idle')
    }
    function onDecline() {
      clearTimeout(inviteTimeoutRef.current)
      setCallError(t('chat.callDeclined'))
      cleanupCall()
      setCallStatus('idle')
    }
    function onSignal({ fromUserId, data }) {
      handleSignal(fromUserId, data)
    }
    function onEnd() {
      cleanupCall()
      setCallStatus('idle')
    }
    function onUnavailable() {
      clearTimeout(inviteTimeoutRef.current)
      setCallError(t('chat.callUnavailable'))
      cleanupCall()
      setCallStatus('idle')
    }

    socket.on('call:invite', onInvite)
    socket.on('call:accept', onAccept)
    socket.on('call:decline', onDecline)
    socket.on('call:signal', onSignal)
    socket.on('call:end', onEnd)
    socket.on('call:unavailable', onUnavailable)
    socket.on('call:rejected', onRejected)

    return () => {
      socket.off('call:invite', onInvite)
      socket.off('call:accept', onAccept)
      socket.off('call:decline', onDecline)
      socket.off('call:signal', onSignal)
      socket.off('call:end', onEnd)
      socket.off('call:unavailable', onUnavailable)
      socket.off('call:rejected', onRejected)
      clearTimeout(inviteTimeoutRef.current)
      cleanupCall()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Seule, la page occupe l'écran entier ; dans la coquille, elle remplit
  // l'espace que celle-ci lui laisse.
  const hauteur = avecBarreLaterale ? 'h-dvh' : 'h-full'
  const Conteneur = avecBarreLaterale ? SidebarInset : 'div'

  return (
    <>
      {avecBarreLaterale && (
      <Sidebar variant="floating" collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t('nav.title')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={toggleSidebar} asChild>
                    <span>
                      <Menu />
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {navItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={!!item.active}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    <User2 /> {user?.fullName || t('shell.userMenu.user')}
                    <ChevronUp className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width]">
                  <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" /> {t('shell.userMenu.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      )}

      <Conteneur className={avecBarreLaterale ? undefined : 'flex flex-1 min-h-0 min-w-0'}>
        <ResizablePanelGroup direction="horizontal" className={hauteur}>
          {/* Les panneaux ont flex-basis:0, donc masquer l'un laisse l'autre
              occuper toute la largeur sans reglage supplementaire. */}
          <ResizablePanel
            defaultSize={25}
            minSize={20}
            className={`flex-grow ${activeDossierId || activeDiscussionId ? 'hidden md:block' : ''}`}
          >
            <div className="flex flex-col h-full border ml-1">
              <div className="h-10 px-2 py-4 flex items-center">
                <p className="ml-1">{t('patient.messages.title')}</p>
              </div>

              <div className="relative px-2 py-4">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5" />
                <Input
                  placeholder={t('patient.messages.title')}
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {loadingContacts && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t('patient.messages.loading')}
                </div>
              )}
              {contactsError && !loadingContacts && (
                <div className="mx-2 rounded-lg bg-destructive/10 text-destructive text-sm px-3 py-2">{contactsError}</div>
              )}
              {!loadingContacts && !contactsError && filteredContacts.length === 0 && discussionsFiltrees.length === 0 && destinatairesNouveaux.length === 0 && (
                <p className="px-4 py-2 text-sm text-muted-foreground">
                  {contacts.length === 0
                    ? t('patient.messages.empty')
                    : rechercheActive
                      ? t('patient.messages.noSearchResults')
                      : t('patient.messages.emptyStart')}
                </p>
              )}

              <ScrollArea className="flex-grow">
                {/* Discussions directes en tete : elles ne portent pas de
                    reference de dossier, c'est le nom qui les identifie. */}
                {discussionsFiltrees.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => ouvrirDiscussion(d.id)}
                    className={`px-4 w-full py-2 hover:bg-accent cursor-pointer text-left border-l-2 ${
                      activeDiscussionId === d.id ? 'bg-primary/10 border-l-primary' : 'border-l-transparent'
                    }`}
                  >
                    <div className="flex flex-row gap-2">
                      <Avatar className="size-12">
                        {d.correspondant?.avatarUrl && <AvatarImage src={d.correspondant.avatarUrl} />}
                        <AvatarFallback>{d.correspondant?.fullName?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex justify-between items-baseline gap-2">
                          <p className="font-semibold truncate">{d.correspondant?.fullName}</p>
                          {d.dernierMessage && (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatListTime(d.dernierMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{t('chat.discussionDirecte')}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {d.dernierMessage ? d.dernierMessage.body : t('patient.messages.noMessageYet')}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}

                {/* Praticiens joignables avec qui aucun fil n'existe encore :
                    c'est le point d'entree pour ecrire a quelqu'un qui vient
                    d'etre recrute. */}
                {destinatairesNouveaux.length > 0 && (
                  <>
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('chat.demarrerDiscussion')}
                    </p>
                    {destinatairesNouveaux.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => demarrerDiscussion(u)}
                        disabled={ouvertureEnCours === u.id}
                        className="px-4 w-full py-2 hover:bg-accent cursor-pointer text-left border-l-2 border-l-transparent disabled:opacity-60"
                      >
                        <div className="flex flex-row gap-2 items-center">
                          <Avatar className="size-10">
                            {u.avatarUrl && <AvatarImage src={u.avatarUrl} />}
                            <AvatarFallback>{u.fullName?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{u.fullName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[u.specialite, u.ville].filter(Boolean).join(' · ') || t(`candidatures.types.${u.role}`)}
                            </p>
                          </div>
                          {ouvertureEnCours === u.id && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {filteredContacts.map(({ dossier, last }) => {
                  const counterpart = counterpartOf(dossier)
                  const specialite = isCoordinateur ? dossier.specialiste?.specialite : dossier.specialiteRequise
                  return (
                    <button
                      key={dossier.id}
                      onClick={() => selectContact(dossier.id)}
                      className={`px-4 w-full py-2 hover:bg-accent cursor-pointer text-left border-l-2 ${
                        activeDossierId === dossier.id ? 'bg-primary/10 border-l-primary' : 'border-l-transparent'
                      }`}
                    >
                      <div className="flex flex-row gap-2">
                        <Avatar className="size-12">
                          {counterpart?.avatarUrl && <AvatarImage src={counterpart.avatarUrl} />}
                          <AvatarFallback>{counterpart?.fullName?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex justify-between items-baseline gap-2">
                            {/* Le dossier fait le titre, pas le correspondant :
                                un meme interlocuteur suit plusieurs dossiers, et
                                son nom seul produisait des lignes strictement
                                identiques. Cote specialiste le probleme etait
                                pire encore, tous les fils affichant le meme
                                contact « Coordination medicale ». */}
                            <p className="font-semibold truncate">#{dossier.reference}</p>
                            {last && (
                              <span className="shrink-0 text-xs text-muted-foreground">{formatListTime(last.createdAt)}</span>
                            )}
                          </div>
                          <p className="text-xs truncate">
                            <span className="font-medium text-foreground/80">{counterpart?.fullName}</span>
                            {specialite && <span className="text-muted-foreground"> · {specialite}</span>}
                          </p>
                          {dossier.motif && (
                            <p className="text-xs text-muted-foreground/80 truncate italic">{dossier.motif}</p>
                          )}
                          <p className="text-sm text-muted-foreground truncate">
                            {last ? last.body || t('chat.attachAria') : t('patient.messages.noMessageYet')}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle className="hidden md:flex" />

          <ResizablePanel defaultSize={75} minSize={40} className={activeDossierId || activeDiscussionId ? '' : 'hidden md:block'}>
            <div className="flex flex-col justify-between h-full ml-1 pb-2">
              {!activeContact && !activeDiscussion ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm px-6 text-center">
                  {loadingContacts ? t('patient.messages.loading') : t('patient.messages.empty')}
                </div>
              ) : (
                <>
                  <div className="h-16 border-b flex items-center px-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={retourListe}
                      aria-label={t('chat.backToList')}
                      className="md:hidden shrink-0 -ml-1 mr-1"
                    >
                      <ChevronLeft />
                    </Button>
                    <Avatar className="size-12 shrink-0">
                      {activeCounterpart?.avatarUrl && <AvatarImage src={activeCounterpart.avatarUrl} />}
                      <AvatarFallback>{activeCounterpart?.fullName?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1 ml-2 min-w-0">
                      <p className="font-semibold truncate">{activeCounterpart?.fullName}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {/* Une discussion directe n'a pas de reference : la
                            coller ferait apparaitre « · #undefined ». */}
                        {filEstDiscussion ? activeSubtitle : `${activeSubtitle} · #${activeContact.dossier.reference}`}
                      </p>
                    </div>
                    <div className="flex-grow flex justify-end gap-2">
                      {activeCounterpart?.id && !filEstDiscussion && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={startCall}
                          disabled={callStatus !== 'idle'}
                          aria-label={t('chat.callAria')}
                        >
                          <Video />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setThreadSearchOpen((v) => !v)}
                        aria-pressed={threadSearchOpen}
                        aria-label={t('chat.searchAria')}
                      >
                        <Search />
                      </Button>
                    </div>
                  </div>

                  {threadSearchOpen && (
                    <div className="border-b px-3 py-2 flex items-center gap-2 bg-muted/40">
                      <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                      <Input
                        autoFocus
                        className="h-8 flex-1 border-0 bg-transparent focus-visible:ring-0"
                        placeholder={t('chat.searchPlaceholder')}
                        value={threadSearchQuery}
                        onChange={(e) => setThreadSearchQuery(e.target.value)}
                      />
                      {threadSearchQuery.trim() && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {t('chat.searchResults', { count: visibleMessages.length })}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setThreadSearchOpen(false)
                          setThreadSearchQuery('')
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
                        aria-label={t('common.close')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <main className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
                    {loadingThread && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center mt-8">
                        <Loader2 className="w-4 h-4 animate-spin" /> {t('patient.chat.loading')}
                      </div>
                    )}
                    {threadError && !loadingThread && (
                      <div className="mx-auto rounded-lg bg-destructive/10 text-destructive text-sm px-3 py-2">{threadError}</div>
                    )}
                    {!loadingThread && !threadError && messages.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground mt-8">{t('patient.chat.empty')}</p>
                    )}
                    {!loadingThread && threadSearchQuery.trim() && visibleMessages.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground mt-8">
                        {t('chat.searchNoResults')}
                      </p>
                    )}
                    {visibleMessages.map((m) => {
                      const isMine = m.senderId === user?.id
                      return (
                        <div key={m.id} className={`flex items-end gap-2 max-w-[75%] ${isMine ? 'self-end' : 'self-start'}`}>
                          <div
                            className={
                              isMine
                                ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-none p-3 shadow-sm'
                                : 'bg-muted text-foreground rounded-2xl rounded-bl-none p-3 shadow-sm border'
                            }
                          >
                            {m.body && <p className="text-sm whitespace-pre-line">{m.body}</p>}
                            {m.document && (
                              <div className={m.body ? 'mt-2' : ''}>
                                <MessageAttachment document={m.document} mine={isMine} />
                              </div>
                            )}
                            <span className={`text-[10px] block text-right mt-1 ${isMine ? 'opacity-70' : 'text-muted-foreground'}`}>
                              {new Date(m.createdAt).toLocaleTimeString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={bottomRef} />
                  </main>

                  {closed ? (
                    <div className="border-t px-4 py-3 text-center text-sm text-muted-foreground">{t('patient.chat.closed')}</div>
                  ) : (
                    <div className="border-t pt-2 flex flex-col gap-2">
                      {uploadError && (
                        <div className="mx-2 rounded-lg bg-destructive/10 text-destructive text-sm px-3 py-2">{uploadError}</div>
                      )}
                      {pendingFile && (
                        <div className="mx-2 flex items-center gap-2 bg-muted border rounded-xl px-3 py-2">
                          <Paperclip className="w-4 h-4 text-primary shrink-0" />
                          <span className="flex-1 min-w-0 text-sm truncate">{pendingFile.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{formatSize(pendingFile.size)}</span>
                          <button
                            type="button"
                            aria-label={t('chat.attachRemove')}
                            onClick={() => setPendingFile(null)}
                            className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      <form onSubmit={sendMessage} className="flex h-10">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={ACCEPTED_MIME.join(',')}
                          onChange={pickFile}
                          className="hidden"
                        />
                        {/* Une piece jointe devient un document du dossier :
                            sans dossier, elle n'aurait ou etre rangee. */}
                        {!filEstDiscussion && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t('chat.attachAria')}
                            title={t('chat.attachAria')}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={sending}
                          >
                            <Paperclip />
                          </Button>
                        )}
                        <Input
                          className="flex-grow border-0"
                          placeholder={pendingFile ? t('chat.attachCaptionPlaceholder') : t('patient.chat.placeholder')}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                        />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          aria-label={t('patient.chat.sendAria')}
                          disabled={sending || (!draft.trim() && !pendingFile)}
                        >
                          {sending ? <Loader2 className="animate-spin" /> : <Send />}
                        </Button>
                      </form>
                    </div>
                  )}
                </>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </Conteneur>

      {(callStatus !== 'idle' || callError) && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground rounded-2xl shadow-xl w-full max-w-lg p-6 flex flex-col gap-4">
            {callStatus === 'ringing' && incomingCall ? (
              <>
                <p className="text-center text-lg font-semibold">
                  {t('chat.incomingCall', { name: incomingCall.fromName })}
                </p>
                <div className="flex justify-center gap-3">
                  <Button variant="destructive" onClick={declineIncomingCall}>
                    {t('chat.declineCall')}
                  </Button>
                  <Button onClick={acceptIncomingCall}>{t('chat.acceptCall')}</Button>
                </div>
              </>
            ) : callStatus !== 'idle' ? (
              <>
                <p className="text-center text-sm text-muted-foreground">
                  {callStatus === 'calling' && t('chat.calling')}
                  {callStatus === 'connecting' && t('chat.connecting')}
                  {callStatus === 'in-call' && t('chat.inCall')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <video ref={localVideoRef} autoPlay muted playsInline className="w-full rounded-lg bg-black aspect-video" />
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full rounded-lg bg-black aspect-video" />
                </div>
                <div className="flex justify-center">
                  <Button variant="destructive" onClick={endCall}>
                    {t('chat.hangUp')}
                  </Button>
                </div>
              </>
            ) : null}
            {callError && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-destructive">{callError}</p>
                <button
                  type="button"
                  onClick={() => setCallError(null)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
                  aria-label={t('common.close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
