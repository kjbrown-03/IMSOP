import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Image as ImageIcon, FileScan, Download, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'

function iconFor(mimeType) {
  if (mimeType?.startsWith('image/')) return ImageIcon
  if (mimeType === 'application/dicom') return FileScan
  return FileText
}

export function formatSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// The storage key never reaches the browser. Downloading asks the API for a
// short-lived signed URL, which re-checks that this user may see the dossier
// and writes a DOCUMENT_DOWNLOAD audit entry on the way.
export default function MessageAttachment({ document, mine, basePath = '/documents' }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const Icon = iconFor(document.mimeType)

  async function open() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { data } = await api.get(`${basePath}/${document.id}/download`)
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err.response?.data?.message || t('errors.downloadFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors w-full min-w-[200px] disabled:opacity-60 ${
          mine
            ? 'bg-white/15 hover:bg-white/25'
            : 'bg-surface-container-low hover:bg-surface-container border border-outline-variant/40'
        }`}
      >
        <span className={`shrink-0 rounded-lg p-2 ${mine ? 'bg-white/20' : 'bg-primary-container text-on-primary-container'}`}>
          <Icon className="w-4 h-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium truncate">{document.filename}</span>
          <span className={`block text-[11px] ${mine ? 'text-on-primary/70' : 'text-on-surface-variant'}`}>
            {formatSize(document.sizeBytes)}
          </span>
        </span>
        {busy ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Download className="w-4 h-4 shrink-0 opacity-70" />}
      </button>
      {error && <span className="text-[11px] text-error px-1">{error}</span>}
    </div>
  )
}
