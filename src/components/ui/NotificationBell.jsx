import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Bell, MessageSquare, FileText, UserCheck, FileCheck, CreditCard,
  Mail, KeyRound, ShieldCheck, ShieldAlert, CheckCheck,
  Paperclip, Stethoscope, HelpCircle, BadgeCheck,
} from 'lucide-react'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useAuthStore } from '../../store/useAuthStore'

const TYPE_META = {
  MESSAGE_RECU: { icon: MessageSquare, tone: 'bg-primary-50 text-primary-600' },
  DOSSIER_SOUMIS: { icon: FileText, tone: 'bg-slate-100 text-slate-600' },
  DOSSIER_AFFECTE: { icon: UserCheck, tone: 'bg-primary-50 text-primary-600' },
  RAPPORT_DISPONIBLE: { icon: FileCheck, tone: 'bg-emerald-50 text-emerald-600' },
  PAIEMENT_CONFIRME: { icon: CreditCard, tone: 'bg-emerald-50 text-emerald-600' },
  NOUVEAU_DOSSIER_SPECIALISTE: { icon: FileText, tone: 'bg-primary-50 text-primary-600' },
  VERIFICATION_EMAIL: { icon: Mail, tone: 'bg-amber-50 text-amber-600' },
  MOT_DE_PASSE_RESET: { icon: KeyRound, tone: 'bg-amber-50 text-amber-600' },
  IDENTITE_VALIDEE: { icon: ShieldCheck, tone: 'bg-emerald-50 text-emerald-600' },
  IDENTITE_REFUSEE: { icon: ShieldAlert, tone: 'bg-rose-50 text-rose-600' },
  PIECE_JOINTE_RECUE: { icon: Paperclip, tone: 'bg-primary-50 text-primary-600' },
  MEDECIN_LOCAL_RATTACHE: { icon: Stethoscope, tone: 'bg-primary-50 text-primary-600' },
  COMPLEMENT_DEMANDE: { icon: HelpCircle, tone: 'bg-amber-50 text-amber-600' },
  COMPLEMENT_FOURNI: { icon: FileCheck, tone: 'bg-emerald-50 text-emerald-600' },
  HABILITATION_STATUT: { icon: BadgeCheck, tone: 'bg-amber-50 text-amber-600' },
  DEUX_FACTEURS: { icon: KeyRound, tone: 'bg-amber-50 text-amber-600' },
  INSCRIPTION_EXISTANTE: { icon: Mail, tone: 'bg-slate-100 text-slate-600' },
}

const FALLBACK_META = { icon: Bell, tone: 'bg-slate-100 text-slate-600' }

// Where clicking the notification takes the user. The secure messaging
// thread only exists between the coordination team and the specialist now -
// the patient and the médecin local get an entry that is still readable and
// dismissable but does not navigate anywhere for a MESSAGE_RECU.
function linkFor(notification, role) {
  if (!notification.dossierId) return null
  if (notification.type === 'MESSAGE_RECU') {
    if (role === 'COORDINATEUR' || role === 'ADMIN') return `/coordinateur/messages/${notification.dossierId}`
    if (role === 'SPECIALISTE') return `/specialiste/messagerie/${notification.dossierId}`
    return null
  }
  if (role === 'PATIENT') return `/patient/dossiers/${notification.dossierId}`
  return null
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const role = useAuthStore((s) => s.user?.role)
  const items = useNotificationStore((s) => s.items)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const loading = useNotificationStore((s) => s.loading)
  const error = useNotificationStore((s) => s.error)
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications)
  const startPolling = useNotificationStore((s) => s.startPolling)
  const stopPolling = useNotificationStore((s) => s.stopPolling)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)

  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    startPolling()
    return stopPolling
  }, [startPolling, stopPolling])

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function describe(notification) {
    const { type, payload, dossierReference } = notification
    const reference = dossierReference || payload?.reference || ''
    const key = TYPE_META[type] ? type : 'fallback'

    if (type === 'MESSAGE_RECU') {
      return {
        title: payload?.senderName
          ? t('notifications.types.MESSAGE_RECU.title', { sender: payload.senderName })
          : t('notifications.types.MESSAGE_RECU.titleFallback'),
        preview: payload?.excerpt || t('notifications.types.MESSAGE_RECU.preview'),
      }
    }

    if (type === 'PIECE_JOINTE_RECUE') {
      return {
        title: payload?.senderName
          ? t('notifications.types.PIECE_JOINTE_RECUE.title', { sender: payload.senderName })
          : t('notifications.types.PIECE_JOINTE_RECUE.titleFallback'),
        preview: payload?.filename || t('notifications.types.PIECE_JOINTE_RECUE.preview', { reference }),
      }
    }

    if (type === 'COMPLEMENT_DEMANDE' && payload?.precisions) {
      return {
        title: t('notifications.types.COMPLEMENT_DEMANDE.title'),
        preview: payload.precisions,
      }
    }

    if (type === 'HABILITATION_STATUT') {
      return {
        title: t('notifications.types.HABILITATION_STATUT.title'),
        preview:
          payload?.motif ||
          t('notifications.types.HABILITATION_STATUT.preview', { statut: payload?.statut || '' }),
      }
    }

    return {
      title: t(`notifications.types.${key}.title`),
      // IDENTITE_REFUSEE carries the coordinator's own wording, which is more
      // useful than the generic sentence.
      preview: payload?.reason || t(`notifications.types.${key}.preview`, { reference }),
    }
  }

  function relativeTime(iso) {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (minutes < 1) return t('notifications.time.now')
    if (minutes < 60) return t('notifications.time.minutes', { count: minutes })
    const hours = Math.round(minutes / 60)
    if (hours < 24) return t('notifications.time.hours', { count: hours })
    const days = Math.round(hours / 24)
    if (days < 7) return t('notifications.time.days', { count: days })
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  }

  // Read/answered notifications are cleared from the bell as soon as they're
  // marked read (individually, "mark all read", or by reading the underlying
  // conversation), so the dropdown only ever shows what still needs attention.
  const unreadItems = items.filter((n) => !n.readAt)

  const onSelect = useCallback(
    (notification) => {
      markRead(notification.id)
      const target = linkFor(notification, role)
      if (target) {
        setOpen(false)
        navigate(target)
      }
    },
    [markRead, navigate, role],
  )

  function onToggle() {
    const next = !open
    setOpen(next)
    if (next) fetchNotifications({ silent: true })
  }

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          unreadCount > 0 ? t('notifications.ariaUnread', { count: unreadCount }) : t('notifications.aria')
        }
        className="relative h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600 active:scale-95"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] max-h-[70vh] flex flex-col rounded-2xl bg-white dark:bg-neutral-900 shadow-xl shadow-slate-900/10 dark:shadow-black/40 ring-1 ring-slate-900/5 dark:ring-white/10 overflow-hidden z-50 animate-fade-in"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('notifications.title')}</h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          <div className="overflow-y-auto">
            {loading && items.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">{t('notifications.loading')}</p>
            )}

            {error && items.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-rose-600 dark:text-rose-400">{error}</p>
            )}

            {!loading && !error && unreadItems.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">{t('notifications.empty')}</p>
            )}

            {unreadItems.map((notification) => {
              const meta = TYPE_META[notification.type] || FALLBACK_META
              const { title, preview } = describe(notification)
              const clickable = !!linkFor(notification, role)
              const Icon = meta.icon

              return (
                <button
                  key={notification.id}
                  type="button"
                  role="menuitem"
                  onClick={() => onSelect(notification)}
                  className={`w-full text-left flex gap-3 px-4 py-3 border-b border-slate-50 dark:border-neutral-800 last:border-b-0 transition-colors bg-primary-50/40 dark:bg-primary-900/20 ${
                    clickable ? 'hover:bg-slate-50 dark:hover:bg-neutral-800 cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <span className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${meta.tone} dark:bg-opacity-20`}>
                    <Icon className="w-4 h-4" />
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm truncate font-bold text-slate-900 dark:text-white">{title}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">{relativeTime(notification.sentAt)}</span>
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{preview}</span>
                  </span>

                  <span className="h-2 w-2 rounded-full bg-primary-600 dark:bg-primary-500 shrink-0 mt-2" />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
