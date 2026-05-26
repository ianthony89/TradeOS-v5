'use client'

import { useEffect, useState } from 'react'
import { Lock, Sun, Moon } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

function useClock() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return tick
}

function fmtClock(tz: string, hour12: boolean) {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12,
  })
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 18) return 'Good Afternoon'
  return 'Good Evening'
}

interface TopbarProps {
  userName?: string
  theme: 'dark' | 'light'
  onThemeToggle: () => void
  onLock: () => void
}

export function Topbar({ userName, theme, onThemeToggle, onLock }: TopbarProps) {
  useClock()   // re-render every second
  const { lang, setLang } = useI18n()

  return (
    <header className="topbar">
      {/* Left: greeting */}
      <div>
        <p className="text-[var(--fg)] font-semibold text-sm">
          {greeting()}{userName ? `, ${userName}` : ''}
        </p>
        <div className="flex gap-3 mt-0.5">
          <span className="pill text-xs">
            🇲🇾 MY {fmtClock('Asia/Kuala_Lumpur', false)}
          </span>
          <span className="pill text-xs">
            🇺🇸 US {fmtClock('America/New_York', true)}
          </span>
        </div>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          className="btn btn-ghost btn-sm"
          title="Toggle language"
        >
          {lang === 'zh' ? 'EN' : '中文'}
        </button>

        <button
          onClick={onThemeToggle}
          className="btn btn-ghost btn-sm"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <button onClick={onLock} className="btn btn-ghost btn-sm" title="Lock">
          <Lock size={14} />
        </button>
      </div>
    </header>
  )
}
