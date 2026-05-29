'use client'

import { useEffect, useState } from 'react'
import { useRouter }    from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { I18nProvider } from '@/lib/i18n/context'
import { Sidebar }      from '@/components/layout/sidebar'
import { Topbar }       from '@/components/layout/topbar'
import { MobileNav }    from '@/components/layout/mobile-nav'
import { useFxRateSync }from '@/lib/hooks/use-fx'
import { useHoldingsStore } from '@/stores/holdings'
import type { Lang }    from '@/lib/i18n/dictionary'

type Theme = 'dark' | 'light'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const supabase = createClient()

  const [theme,    setTheme]    = useState<Theme>('dark')
  const [lang,     setLang]     = useState<Lang>('en')
  const [userName, setUserName] = useState<string>('')
  const [loading,  setLoading]  = useState(true)

  /* Start FX sync loop. Single instance for the whole app session. */
  useFxRateSync()

  /* Position count for topbar meta line — reactive to store. */
  const positions = useHoldingsStore(s => s.holdings.length)

  /* Load profile */
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, lang, theme')
        .eq('id', user.id)
        .single()

      if (profile) {
        if (profile.name)  setUserName(profile.name)
        if (profile.lang)  setLang(profile.lang as Lang)
        if (profile.theme) setTheme(profile.theme as Theme)
      }
      setLoading(false)
    }
    load()
  }, [router, supabase])

  /* Sync theme attribute to <html> */
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  async function handleThemeToggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ theme: next }).eq('id', user.id)
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        data-theme="dark"
        style={{ background: 'var(--bg-base)' }}
      >
        <div
          className="w-7 h-7 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--accent)' }}
        />
      </div>
    )
  }

  return (
    <I18nProvider initialLang={lang}>
      <div className="app-shell">
        <Sidebar />
        <Topbar
          userName={userName}
          positions={positions}
          theme={theme}
          onThemeToggle={handleThemeToggle}
        />
        <main className="app-stage">{children}</main>
        <MobileNav />
      </div>
    </I18nProvider>
  )
}
