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
      <div className="flex items-center gap-1 px-3 py-1.5 w-full">
        <Languages size={13} className="text-white/40 mr-1 flex-shrink-0" />
        <div className="flex bg-white/10 rounded-md overflow-hidden">
          {pills.map(p => (
            <button
              key={p.id}
              onClick={() => setLang(p.id)}
              className={`px-2.5 py-1 text-[11px] font-bold transition-all ${
                lang === p.id
                  ? 'bg-blue-500 text-white'
                  : 'text-white/50 hover:text-white/80'
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
    <div className="flex items-center bg-surface-low border border-border-subtle rounded-full overflow-hidden shadow-sm">
      {pills.map(p => (
        <button
          key={p.id}
          onClick={() => setLang(p.id)}
          className={`px-3 py-1.5 text-xs font-bold transition-all ${
            lang === p.id
              ? 'bg-primary-override text-white'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-lowest'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
