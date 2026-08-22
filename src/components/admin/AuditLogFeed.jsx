import { useTranslation } from 'react-i18next'
import { Activity, User } from 'lucide-react'

const ACTION_COLORS = {
  ADMIN_USER_CREATED: 'bg-blue-50 text-blue-700 border-blue-200',
  ADMIN_USER_UPDATED: 'bg-slate-100 text-slate-600 border-slate-200',
  ADMIN_USER_DEACTIVATED: 'bg-rose-50 text-rose-700 border-rose-200',
  ADMIN_USER_REACTIVATED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DOSSIER_SOUMIS: 'bg-blue-50 text-blue-700 border-blue-200',
  DOSSIER_VIEW: 'bg-slate-100 text-slate-500 border-slate-200',
  DOSSIER_UPDATE: 'bg-slate-100 text-slate-600 border-slate-200',
  DOSSIER_ASSIGNE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  DOSSIER_ACCEPTE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DOSSIER_REFUSE: 'bg-rose-50 text-rose-700 border-rose-200',
  DOCUMENT_UPLOAD: 'bg-violet-50 text-violet-700 border-violet-200',
  DOCUMENT_DOWNLOAD: 'bg-slate-100 text-slate-500 border-slate-200',
  RAPPORT_VALIDE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PAIEMENT_CONFIRME: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

function colorFor(action) {
  return ACTION_COLORS[action] || 'bg-slate-100 text-slate-600 border-slate-200'
}

export default function AuditLogFeed({ logs, loading }) {
  const { t, i18n } = useTranslation()

  function formatDateTime(iso) {
    return new Date(iso).toLocaleString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading) {
    return <div className="glass-card rounded-3xl p-10 text-center text-slate-500 animate-fade-in-up">{t('common.loading')}</div>
  }

  if (!logs || logs.length === 0) {
    return <div className="glass-card rounded-3xl p-10 text-center text-slate-500 animate-fade-in-up">{t('admin.journal.empty')}</div>
  }

  return (
    <div className="glass-card rounded-3xl overflow-hidden animate-fade-in-up">
      {logs.map((log, idx) => (
        <div
          key={log.id}
          className={`flex items-start gap-4 px-5 py-4 ${idx < logs.length - 1 ? 'border-b border-slate-100/60' : ''}`}
        >
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${colorFor(log.action)}`}>
                {log.action}
              </span>
              {log.entityType && (
                <span className="text-xs text-slate-400">{log.entityType}{log.entityId ? ` #${log.entityId.slice(0, 8)}` : ''}</span>
              )}
            </div>
            <div className="text-sm text-slate-700 mt-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              {log.user ? `${log.user.fullName} (${log.user.role})` : t('admin.journal.systemActor')}
            </div>
          </div>
          <div className="text-xs text-slate-400 shrink-0 whitespace-nowrap">{formatDateTime(log.createdAt)}</div>
        </div>
      ))}
    </div>
  )
}
