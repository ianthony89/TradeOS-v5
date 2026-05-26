'use client'

import { useEffect, useState } from 'react'
import { useRouter }      from 'next/navigation'
import { createClient }   from '@/lib/supabase/client'
import { I18nProvider }   from '@/lib/i18n/context'
import { Sidebar }        from '@/components/layout/sidebar'
import { Topbar }         from '@/components/layout/topbar'
import { MobileNav }      from '@/components/layout/mobile-nav'
import type { Lang }      from '@/lib/i18n/dictionary'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const supabase = createClient()

  const [theme,    setTheme]    = useState<'dark' | 'light'>('dark')
  const [lang,     setLang]     = useState<Lang>('en')
  const [userName, setUserName] = useState<string>('')
  const [loading,  setLoading]  = useState(true)

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
        setUserName(profile.name)
        setLang((profile.lang ?? 'en') as Lang)
        setTheme((profile.theme ?? 'dark') as 'dark' | 'light')
      }
      setLoading(false)
    }
    load()
  }, [])

  function handleThemeToggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    supabase.from('profiles').update({ theme: next })
      .eq('id', supabase.auth.getUser().then(r => r.data.user?.id ?? ''))
  }

  async function handleLock() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]"
           data-theme="dark">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <I18nProvider initialLang={lang}>
      <div data-theme={theme} className="app-shell">
        {/* Sidebar — hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Topbar */}
        <Topbar
          userName={userName}
          theme={theme}
          onThemeToggle={handleThemeToggle}
          onLock={handleLock}
        />

        {/* Main content */}
        <main className="stage animate-fadeIn">
          {children}
        </main>

        {/* Bottom nav — mobile only */}
        <div className="md:hidden">
          <MobileNav />
        </div>
      </div>
    </I18nProvider>
  )
}
