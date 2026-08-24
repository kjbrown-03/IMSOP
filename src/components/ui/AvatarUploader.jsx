import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Loader2, Trash2, User } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

function initials(fullName) {
  if (!fullName) return null
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

/**
 * Photo de profil éditable, commune à tous les rôles : la photo est portée par
 * l'utilisateur et non par le profil patient/spécialiste, donc le composant lit
 * et écrit directement dans le store d'authentification.
 *
 * @param {Object} props
 * @param {number} [props.size] diamètre en pixels
 * @param {boolean} [props.allowRemove] affiche le bouton de suppression
 * @param {string} [props.className]
 */
export default function AvatarUploader({ size = 128, allowRemove = true, className }) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar)
  const removeAvatar = useAuthStore((s) => s.removeAvatar)

  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // Aperçu local pendant l'envoi : l'utilisateur voit sa photo immédiatement au
  // lieu d'attendre l'aller-retour réseau puis le rechargement de l'image.
  const [preview, setPreview] = useState(null)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function onFileSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)
    // Vérifié ici en plus du serveur : inutile d'envoyer 20 Mo pour se faire
    // refuser, et le message arrive instantanément.
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t('profile.errorFormat'))
      return
    }
    if (file.size > MAX_BYTES) {
      setError(t('profile.errorSize'))
      return
    }

    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)
    setBusy(true)
    const result = await uploadAvatar(file)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      setPreview(null)
      URL.revokeObjectURL(localPreview)
    }
  }

  async function onRemove() {
    setError(null)
    setBusy(true)
    const result = await removeAvatar()
    setBusy(false)
    if (result.ok) setPreview(null)
    else setError(result.error)
  }

  const source = preview || user?.avatarUrl
  const label = initials(user?.fullName)

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        className="relative rounded-full overflow-hidden border-4 border-white dark:border-neutral-800 shadow-lg shrink-0 group"
        style={{ width: size, height: size }}
      >
        {source ? (
          <img src={source} alt={t('profile.photoAlt')} className="h-full w-full object-cover" />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center bg-slate-200 dark:bg-neutral-700 font-display font-bold text-slate-500 dark:text-neutral-300"
            style={{ fontSize: size * 0.32 }}
          >
            {label || <User style={{ width: size * 0.4, height: size * 0.4 }} />}
          </span>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={t('profile.changePhoto')}
          className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity disabled:opacity-100 disabled:cursor-wait"
        >
          {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={onFileSelected}
        className="hidden"
      />

      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="text-sm font-semibold text-[var(--color-primary)] hover:underline disabled:opacity-50"
          >
            {busy ? t('profile.uploading') : t('profile.changePhoto')}
          </button>
          {allowRemove && user?.avatarUrl && !busy && (
            <button
              type="button"
              onClick={onRemove}
              className="flex items-center gap-1 text-sm font-semibold text-rose-600 hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('profile.removePhoto')}
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('profile.photoHint')}</p>
        {error && <p className="text-xs font-semibold text-rose-600 text-center max-w-[220px]">{error}</p>}
      </div>
    </div>
  )
}
