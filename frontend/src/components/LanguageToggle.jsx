import { useLanguage } from '../i18n/LanguageContext'
import { Languages } from 'lucide-react'

export default function LanguageToggle({ variant = 'sidebar' }) {
  const { lang, setLang } = useLanguage()

  const pills = [
    { id: 'en', label: 'EN' },
    { id: 'gu', label: 'ગુ' },
  ]

  if (variant === 'sidebar') {
    return (
      <div className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-white/65 font-sans">
        <Languages size={18} className="flex-shrink-0" />
        <div className="flex bg-white/10 border border-white/5 rounded-md overflow-hidden w-full">
          {pills.map(p => (
            <button
              key={p.id}
              onClick={() => setLang(p.id)}
              className={`flex-1 py-1 text-xs font-bold transition-all ${
                lang === p.id
                  ? 'bg-[#1e3a8a] text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Navbar variant
  return (
    <div className="flex items-center overflow-hidden rounded-full border border-border-subtle bg-surface-low shadow-sm dark:border-[#334155] dark:bg-[#101722] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      {pills.map(p => (
        <button
          key={p.id}
          onClick={() => setLang(p.id)}
          className={`px-3 py-1.5 text-xs font-bold transition-all ${
            lang === p.id
              ? 'bg-primary-override text-white dark:bg-[#dbe8f6] dark:text-[#08111d]'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-lowest dark:text-[#d7e0ec] dark:hover:bg-white/10 dark:hover:text-white'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
