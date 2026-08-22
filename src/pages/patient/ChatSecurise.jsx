import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Paperclip, Loader2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/useAuthStore'
import MessageAttachment, { formatSize } from '../../components/ui/MessageAttachment'

// Mirrors backend/src/middleware/upload.js. Checking here too turns a 25 Mo
// mistake into an instant message instead of a wasted upload over a mobile link.
const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'application/dicom']
const MAX_BYTES = 25 * 1024 * 1024

export default function ChatSecurise() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const currentUser = useAuthStore((s) => s.user)
  const [dossier, setDossier] = useState(null)
  const [messages, setMessages] = useState([])
  const [messagingClosesAt, setMessagingClosesAt] = useState(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)
  const bottomRef = useRef(null)

  // The conversation is shared by the patient, the international specialist and
  // the local doctor, so "the other side" depends on who is reading.
  const isPatient = currentUser?.role === 'PATIENT'
  const counterpart = isPatient
    ? dossier?.specialiste?.user
    : dossier?.patient?.user
  const counterpartSubtitle = isPatient
    ? dossier?.specialiste?.specialite
    : t('chat.patientFile')
  const backTo = isPatient ? '/patient/messages' : '/medecin/dossiers'

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [{ data: dossierData }, { data: msgData }] = await Promise.all([
          api.get(`/dossiers/${id}`),
          api.get(`/dossiers/${id}/messages`),
        ])
        if (cancelled) return
        setDossier(dossierData)
        setMessages(msgData.messages)
        setMessagingClosesAt(msgData.messagingClosesAt)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || t('errors.conversationNotFound'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, t])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const closed = messagingClosesAt && new Date(messagingClosesAt) < new Date()

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
    if (!pendingFile || sending) return
    setSending(true)
    setUploadError(null)
    const form = new FormData()
    form.append('file', pendingFile)
    // The caption travels with the file so one bubble carries both.
    if (draft.trim()) form.append('body', draft.trim())
    try {
      const { data } = await api.post(`/dossiers/${id}/messages/piece-jointe`, form)
      setMessages((prev) => [...prev, data])
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
    setSending(true)
    try {
      const { data } = await api.post(`/dossiers/${id}/messages`, { body: draft.trim() })
      setMessages((prev) => [...prev, data])
      setDraft('')
    } catch (err) {
      setError(err.response?.data?.message || t('errors.sendMessageFailed'))
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-background text-on-background h-screen flex items-center justify-center">
        <p className="text-on-surface-variant">{t('patient.chat.loading')}</p>
      </div>
    )
  }

  if (error && !dossier) {
    return (
      <div className="bg-background text-on-background h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-on-surface-variant">{error}</p>
        <button onClick={() => navigate(backTo)} className="text-primary font-label-md text-label-md">
          {t('patient.chat.backToMessages')}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-background text-on-background h-screen flex flex-col font-body-md overflow-hidden">
      <header className="bg-surface flex justify-between items-center px-margin-mobile w-full h-14 border-b border-outline-variant shrink-0 z-10 relative">
        <button
          aria-label={t('common.back')}
          className="text-primary hover:bg-surface-container-low rounded-full p-2 transition-colors duration-200 ease-in-out"
          onClick={() => navigate(backTo)}
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <span className="font-headline-md text-headline-md font-bold text-primary">
              {counterpart?.fullName}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {counterpartSubtitle} - #{dossier?.reference}
            </span>
          </div>
        </div>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto px-margin-mobile py-stack-md flex flex-col gap-stack-md bg-surface-container-lowest">
        {messages.length === 0 && (
          <p className="text-center text-on-surface-variant font-label-sm text-label-sm mt-8">
            {t('patient.chat.empty')}
          </p>
        )}
        {messages.map((m) => {
          const isMine = m.senderId === currentUser?.id
          return (
            <div key={m.id} className={`flex items-end gap-2 max-w-[85%] ${isMine ? 'self-end' : 'self-start'}`}>
              <div
                className={
                  isMine
                    ? 'bg-primary text-on-primary rounded-2xl rounded-br-none p-3 shadow-sm'
                    : 'bg-surface-variant text-on-surface rounded-2xl rounded-bl-none p-3 shadow-sm border border-outline-variant/30'
                }
              >
                {m.body && <p className="font-body-md text-body-md whitespace-pre-line">{m.body}</p>}
                {m.document && (
                  <div className={m.body ? 'mt-2' : ''}>
                    <MessageAttachment document={m.document} mine={isMine} />
                  </div>
                )}
                <span className={`font-label-sm text-[10px] block text-right mt-1 ${isMine ? 'text-on-primary/70' : 'text-on-surface-variant'}`}>
                  {new Date(m.createdAt).toLocaleTimeString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </main>

      {closed ? (
        <footer className="bg-surface-container-low border-t border-outline-variant p-4 text-center shrink-0">
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            {t('patient.chat.closed')}
          </p>
        </footer>
      ) : (
        <footer className="bg-surface border-t border-outline-variant p-3 shrink-0 flex flex-col gap-2 pb-6 md:pb-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {uploadError && (
            <div className="bg-error-container text-on-error-container text-label-sm font-label-sm rounded-lg px-3 py-2">
              {uploadError}
            </div>
          )}
          {pendingFile && (
            <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2">
              <Paperclip className="w-4 h-4 text-primary shrink-0" />
              <span className="flex-1 min-w-0 text-sm truncate text-on-surface">{pendingFile.name}</span>
              <span className="text-[11px] text-on-surface-variant shrink-0">{formatSize(pendingFile.size)}</span>
              <button
                type="button"
                aria-label={t('chat.attachRemove')}
                onClick={() => setPendingFile(null)}
                className="text-on-surface-variant hover:text-error transition-colors p-1 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <form onSubmit={sendMessage} className="flex-1 flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_MIME.join(',')}
              onChange={pickFile}
              className="hidden"
            />
            <button
              type="button"
              aria-label={t('chat.attachAria')}
              title={t('chat.attachAria')}
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-full w-12 h-12 flex items-center justify-center shrink-0 transition-colors disabled:opacity-60"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <div className="flex-1 bg-surface-container-low border border-outline-variant rounded-2xl overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
              <textarea
                className="w-full bg-transparent border-none focus:ring-0 resize-none px-4 py-3 max-h-32 min-h-[48px] font-body-md text-body-md text-on-surface placeholder-on-surface-variant outline-none"
                placeholder={pendingFile ? t('chat.attachCaptionPlaceholder') : t('patient.chat.placeholder')}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage(e)
                  }
                }}
              />
            </div>
            <button
              aria-label={t('patient.chat.sendAria')}
              type="submit"
              disabled={sending || (!draft.trim() && !pendingFile)}
              className="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container rounded-full w-12 h-12 flex items-center justify-center shrink-0 transition-colors shadow-md disabled:opacity-60"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  send
                </span>
              )}
            </button>
          </form>
        </footer>
      )}
    </div>
  )
}
