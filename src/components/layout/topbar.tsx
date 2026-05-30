'use client'

import { useState } from 'react'
import { Sun, Moon, Languages } from 'lucide-react'
import { useI18n }       from '@/lib/i18n/context'
import { useHoldingsStore } from '@/stores/holdings'
import type { Lang }     from '@/lib/i18n/dictionary'
import { MarketPill }    from '@/components/ui/market-pill'
import { FxPill }        from '@/components/ui/fx-pill'
import { SyncPill }      from '@/components/ui/sync-pill'
import { FlagMY, FlagUS } from '@/components/brand/flags'

type Bucket = 'morning' | 'afternoon' | 'evening'

function bucketForHour(h: number): Bucket {
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

const GREETING: Record<Lang, Record<Bucket, string>> = {
  en: { morning: 'Good Morning', afternoon: 'Good Afternoon', evening: 'Good Evening' },
  zh: { morning: '早安',          afternoon: '午安',            evening: '晚安' },
}

/** Random encouragement pools — local only, no DB, no API. */
const TIPS: Record<Lang, Record<Bucket, string[]>> = {
  en: {
    morning: [
      'Ready to hunt for opportunities today?',
      "What's your profit target today?",
      'A good trade starts with a good plan.',
      'Focus on process, not outcome.',
      'Coffee first. Market second.',
    ],
    afternoon: [
      'How is the portfolio doing today?',
      'Stick to your plan.',
      'The market rewards patience.',
      'Green or red, stay disciplined.',
      "Don't chase. Let opportunities come.",
    ],
    evening: [
      'Markets never sleep.',
      "Time to review today's decisions.",
      'The best traders keep a journal.',
      'What did the market teach you today?',
      'Profit fades. Lessons stay.',
    ],
  },
  zh: {
    morning: [
      '今天想赚多少钱？',
      '先看计划，再看股价。',
      '市场每天都给机会。',
      '别急着下单，先观察。',
      '今天的目标是什么？',
    ],
    afternoon: [
      '今天市场送你什么机会？',
      '有守纪律吗？',
      '赚钱靠等待，不靠冲动。',
      '别让情绪替你交易。',
      '检查一下持仓吧。',
    ],
    evening: [
      '复盘一下今天的战绩吧。',
      '今天学到了什么？',
      '市场关门了，功课还没结束。',
      '好交易来自好习惯。',
      '赚钱是结果，纪律是过程。',
    ],
  },
}

function todayLabel(lang: Lang) {
  // Full weekday + date, localized: "Saturday, 30 May 2026" / "2026年5月30日星期六"
  return new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-GB', {
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
  const { lang, setLang, t } = useI18n()

  /* Greeting + a random encouragement. Bucket and the random index are
     picked once per mount (i.e. once per page load → fresh on every refresh);
     the language toggle only swaps the wording, keeping the same pick. */
  const [bucket] = useState<Bucket>(() => bucketForHour(new Date().getHours()))
  const [tipIdx] = useState(() => Math.floor(Math.random() * 1000))
  const pool = TIPS[lang][bucket]
  const tip  = pool[tipIdx % pool.length]

  const holdings = useHoldingsStore(s => s.holdings)
  const total    = positions ?? holdings.length
  const usdCount = holdings.filter(h => h.currency === 'USD').length
  const myrCount = holdings.filter(h => h.currency === 'MYR').length
  const breakdown = usdCount || myrCount
    ? ` (${usdCount} USD${myrCount ? ` · ${myrCount} MYR` : ''})`
    : ''

  return (
    <header className="topbar">
      {/* Left: greeting + meta */}
      <div className="topbar-left">
        <h2 className="topbar-greeting" suppressHydrationWarning>
          {GREETING[lang][bucket]}{userName ? `, ${userName}` : ''}
          {tip && (
            <>
              <span className="topbar-sep" suppressHydrationWarning>·</span>
              <span className="topbar-tip" suppressHydrationWarning>{tip}</span>
            </>
          )}
        </h2>
        <div className="topbar-sub">
          <span suppressHydrationWarning>{todayLabel(lang)}</span>
          {total > 0 && (
            <>
              <span className="topbar-sep">·</span>
              <span>{total} {t('positions_label')}{breakdown}</span>
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
