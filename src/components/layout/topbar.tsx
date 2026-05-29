'use client'

import { Sun, Moon, Languages } from 'lucide-react'
import { useI18n }       from '@/lib/i18n/context'
import { MarketPill }    from '@/components/ui/market-pill'
import { FxPill }        from '@/components/ui/fx-pill'
import { SyncPill }      from '@/components/ui/sync-pill'
import { FlagMY, FlagUS } from '@/components/brand/flags'

function greetingPart() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 18) return 'Good Afternoon'
  return 'Good Evening'
}

function todayLabel() {
  // Full weekday + day-month-year, e.g. "Saturday, 30 May 2026"
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

interface TopbarProps {
  userName?:     string
  positions?:    number
  theme:         'dark' | 'light'
  onThemeToggle: () => void
}

export function Topbar({ userName, positions, theme, onThemeToggle }: TopbarProps) {
  const { lang, setLang } = useI18n()

  return (
    <header className="topbar">
      {/* Left: greeting + meta */}
      <div className="topbar-left">
        <h2 className="topbar-greeting">
          {greetingPart()}{userName ? `, ${userName}` : ''}
        </h2>
        <div className="topbar-sub">
          <span>{todayLabel()}</span>
          {typeof positions === 'number' && positions > 0 && (
            <>
              <span className="text-quaternary">·</span>
              <span>{positions} Positions</span>
            </>
          )}
        </div>
      </div>

      {/* Center pulse — markets + FX + sync */}
      <div className="topbar-pulse">
        <MarketPill market="MY" flag={<FlagMY size={12} />} />
        <MarketPill market="US" flag={<FlagUS size={12} />} />
        <FxPill />
        <SyncPill />
      </div>

      {/* Right: controls */}
      <div className="topbar-actions">
        <button
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          className="btn btn-ghost btn-sm"
          title="Toggle language"
          aria-label="Toggle language"
        >
          <Languages size={13} />
          <span>{lang === 'zh' ? 'EN' : '中'}</span>
        </button>
        <button
          onClick={onThemeToggle}
          className="btn btn-icon"
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </header>
  )
}
