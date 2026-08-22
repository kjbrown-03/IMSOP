import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BottomNav from '../../components/layout/BottomNav'

export default function MatchingEnCours() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  useEffect(() => {
    const timer = setTimeout(() => navigate('/patient/dossiers'), 2500)
    return () => clearTimeout(timer)
  }, [navigate, location.state])

  return (
    <div className="bg-background-alt text-text-main antialiased min-h-screen flex flex-col relative pb-24">
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-margin-mobile h-12 bg-surface border-b border-outline-variant shadow-sm md:shadow-none">
        <div className="h-8 w-8" />
        <h1 className="font-headline-md text-headline-md font-bold text-primary text-center flex-1">IMSOP</h1>
        <div className="h-8 w-8" />
      </header>
      <main className="flex-1 w-full max-w-[1200px] mx-auto mt-16 px-margin-mobile flex flex-col gap-stack-lg h-full">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-8 py-12 h-full">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-32 h-32 bg-primary-container/30 rounded-full animate-ping" />
            <div className="absolute w-24 h-24 bg-primary-container/50 rounded-full animate-pulse" />
            <div className="relative w-16 h-16 bg-primary-container rounded-full flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-on-primary-container text-[32px]">verified</span>
            </div>
          </div>
          <div className="flex flex-col gap-4 max-w-md">
            <h2 className="font-headline-md text-headline-md text-primary">
              {t('patient.matching.confirmedTitle')}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {t('patient.matching.confirmedText')}
            </p>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
