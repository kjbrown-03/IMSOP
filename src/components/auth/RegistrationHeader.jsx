import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function RegistrationHeader({ onBack }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <header className="bg-[var(--color-surface)] fixed top-0 w-full z-50 border-b border-[var(--color-border)] flex justify-between items-center px-margin-mobile h-12 transition-colors duration-300">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack || (() => navigate(-1))}
          className="text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] transition-colors active:opacity-80 rounded-full p-1 flex items-center justify-center"
          aria-label={t('common.back')}
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline-md text-headline-md-mobile font-bold text-[var(--color-primary)]">IMSOP</h1>
      </div>
      <div className="w-8 h-8" />
    </header>
  )
}
