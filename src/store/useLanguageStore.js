import { create } from 'zustand'
import i18n from '../i18n/config'

const STORAGE_KEY = 'imsop_lang'

export const useLanguageStore = create((set) => ({
  lang: i18n.language || 'fr',
  setLang: (next) => {
    localStorage.setItem(STORAGE_KEY, next)
    i18n.changeLanguage(next)
    set({ lang: next })
  },
  toggleLang: () =>
    set((s) => {
      const next = s.lang === 'fr' ? 'en' : 'fr'
      localStorage.setItem(STORAGE_KEY, next)
      i18n.changeLanguage(next)
      return { lang: next }
    }),
}))
