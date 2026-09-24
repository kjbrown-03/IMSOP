import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Globe } from '../components/ui/cosmic-404'

const apparition = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: 'easeOut' } },
}

const globeVariants = {
  hidden: { scale: 0.85, opacity: 0, y: 10 },
  visible: { scale: 1, opacity: 1, y: 0, transition: { duration: 1, ease: 'easeOut' } },
  flottement: {
    y: [-4, 4],
    transition: { duration: 5, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' },
  },
}

export default function NotFound() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Arriver ici par un lien externe est le cas courant : l'historique est alors
  // vide, et un simple `navigate(-1)` ferait sortir de l'application.
  function retour() {
    if (window.history.state && window.history.state.idx > 0) navigate(-1)
    else navigate('/')
  }

  return (
    // Cette page assume le fond sombre de l'application quel que soit le theme
    // choisi : le globe lumineux n'existe que sur ce fond-la, et une page d'erreur
    // a le droit de rompre avec le decor habituel.
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0F1D26] px-4 py-16">
      <AnimatePresence mode="wait">
        <motion.div
          className="text-center"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={apparition}
        >
          <div className="mb-10 flex items-center justify-center gap-5 md:gap-6">
            <motion.span
              className="select-none text-7xl font-bold text-[#E7EEF0]/80 md:text-8xl"
              variants={apparition}
            >
              4
            </motion.span>

            <motion.div
              className="relative h-28 w-28 md:h-36 md:w-36"
              variants={globeVariants}
              animate={['visible', 'flottement']}
            >
              <Globe />
            </motion.div>

            <motion.span
              className="select-none text-7xl font-bold text-[#E7EEF0]/80 md:text-8xl"
              variants={apparition}
            >
              4
            </motion.span>
          </div>

          <motion.h1
            className="mb-4 text-3xl font-semibold tracking-tight text-[#F4F8F8] md:text-5xl"
            variants={apparition}
          >
            {t('errors.notFoundTitle')}
          </motion.h1>

          <motion.p
            className="mx-auto mb-10 max-w-md text-base leading-relaxed text-[#93A7AF] md:text-lg"
            variants={apparition}
          >
            {t('errors.notFoundText')}
          </motion.p>

          <motion.div className="flex flex-col items-center gap-5" variants={apparition}>
            <button
              type="button"
              onClick={retour}
              className="inline-flex items-center gap-2 rounded-md bg-[#8FC4BA] px-5 py-2.5 text-sm font-semibold text-[#0F2C38] transition-transform duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8FC4BA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1D26]"
            >
              <ArrowLeft className="h-5 w-5" />
              {t('common.back')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded text-sm font-semibold text-[#93A7AF] underline-offset-4 transition-colors hover:text-[#B7C9CF] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8FC4BA]/60"
            >
              {t('common.backHome')}
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
