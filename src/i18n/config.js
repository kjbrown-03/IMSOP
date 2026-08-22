import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import fr from './locales/fr.json'
import en from './locales/en.json'

const STORAGE_KEY = 'imsop_lang'

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: localStorage.getItem(STORAGE_KEY) || 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
})

export default i18n
