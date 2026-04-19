import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle({ variant = 'sidebar' }) {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('eduguard-theme')
      if (stored) return stored === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('eduguard-theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggle = () => setDark(prev => !prev)

  // Sidebar variant — subtle, fits the dark sidebar
  if (variant === 'sidebar') {
    return (
      <button
        onClick={toggle}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-white/65 hover:text-white hover:bg-white/5 rounded-lg transition-all font-sans"
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
        {dark ? 'Light mode' : 'Dark mode'}
      </button>
    )
  }

  // Navbar variant — for landing/login pages (light background)
  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative w-9 h-9 flex items-center justify-center rounded-full
        border border-border-subtle
        bg-surface-lowest hover:bg-surface-low
        text-text-secondary hover:text-text-primary
        transition-all shadow-sm hover:shadow"
    >
      <Sun
        size={16}
        className={`absolute transition-all duration-300 ${
          dark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'
        }`}
      />
      <Moon
        size={16}
        className={`absolute transition-all duration-300 ${
          dark ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
        }`}
      />
    </button>
  )
}
