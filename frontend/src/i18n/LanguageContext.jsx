import { createContext, useContext, useState, useCallback } from 'react'
import en from './en'
import gu from './gu'

const DICTIONARIES = { en, gu }
const STORAGE_KEY = 'eduguard-lang'

const LanguageContext = createContext()

function resolve(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj)
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) || 'en'
    }
    return 'en'
  })

  const setLang = useCallback((l) => {
    setLangState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }, [])

  const t = useCallback((key) => {
    if (!key) return null
    return resolve(DICTIONARIES[lang], key) ?? resolve(DICTIONARIES.en, key) ?? key
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be inside LanguageProvider')
  return ctx
}
