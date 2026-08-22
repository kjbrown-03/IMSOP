import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BottomNav from '../../components/layout/BottomNav'
import { api } from '../../lib/api'

export default function ListeMessages() {
  const { t, i18n } = useTranslation()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function formatTime(iso) {
    const date = new Date(iso)
    const now = new Date()
    const sameDay = date.toDateString() === now.toDateString()
    const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
    if (sameDay) return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' })
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get('/dossiers')
        const withSpecialiste = data.items.filter((d) => d.specialiste)
        const withMessages = await Promise.all(
          withSpecialiste.map(async (d) => {
            try {
              const { data } = await api.get(`/dossiers/${d.id}/messages`)
              const last = data.messages[data.messages.length - 1]
              return { dossier: d, last }
            } catch {
              return { dossier: d, last: null }
            }
          }),
        )
        if (!cancelled) setConversations(withMessages)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || t('errors.loadMessagesFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [t])

  return (
    <div className="bg-background text-on-background antialiased min-h-screen pb-20 md:pb-0">
      <header className="bg-surface border-b border-outline-variant flex justify-between items-center px-margin-mobile w-full h-14 z-40 fixed md:relative">
        <div className="w-10" />
        <h1 className="text-headline-md font-headline-md font-bold text-primary">IMSOP</h1>
        <div className="w-10" />
      </header>

      <main className="max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop py-stack-md pt-20 md:pt-stack-md">
        <div className="mb-stack-lg">
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-primary mb-stack-sm">
            {t('patient.messages.title')}
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {t('patient.messages.subtitle')}
          </p>
        </div>

        {loading && <div className="bg-surface rounded-xl border border-outline-variant p-8 text-center text-on-surface-variant">{t('patient.messages.loading')}</div>}

        {error && !loading && (
          <div className="bg-error-container text-on-error-container text-label-sm font-label-sm rounded-lg px-4 py-3">{error}</div>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div className="bg-surface rounded-xl border border-outline-variant p-10 text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              {t('patient.messages.empty')}
            </p>
          </div>
        )}

        {conversations.length > 0 && (
          <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden shadow-sm">
            {conversations.map(({ dossier, last }, i) => (
              <Link
                key={dossier.id}
                to={`/patient/messages/${dossier.id}`}
                className={`flex items-start p-4 hover:bg-surface-container-lowest transition-colors relative block group cursor-pointer ${
                  i < conversations.length - 1 ? 'border-b border-outline-variant' : ''
                }`}
              >
                <div className="flex-shrink-0 relative mr-4">
                  <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-headline-md text-headline-md border border-outline-variant">
                    <span className="material-symbols-outlined">stethoscope</span>
                  </div>
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-label-md text-label-md text-on-surface truncate pr-2">
                      {dossier.specialiste.user.fullName}
                    </h3>
                    {last && (
                      <span className="flex-shrink-0 font-label-sm text-label-sm text-on-surface-variant">
                        {formatTime(last.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">
                    {dossier.specialiste.specialite} - {t('patient.dashboard.reference')} #{dossier.reference}
                  </p>
                  <p className="font-body-md text-body-md text-on-surface-variant truncate">
                    {last ? last.body : t('patient.messages.noMessageYet')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
