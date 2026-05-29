'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Briefcase, Eye, BookOpen,
  Calculator, Bot, Settings, LogOut,
} from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/brand/logo'

const NAV_GROUPS = [
  {
    label: 'Portfolio',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, key: 'nav_dashboard' },
      { href: '/holdings',  icon: Briefcase,       key: 'nav_holdings'  },
      { href: '/watchlist', icon: Eye,             key: 'nav_watchlist' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/journal', icon: BookOpen,   key: 'nav_journal' },
      { href: '/planner', icon: Calculator, key: 'nav_planner' },
      { href: '/ai',      icon: Bot,        key: 'nav_ai'      },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/settings', icon: Settings, key: 'nav_settings' },
    ],
  },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const t        = useT()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-mark">
          <Logo size={22} />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">TradeOS</span>
          <span className="sidebar-brand-meta">by Anthony · v5</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV_GROUPS.map(group => (
          <div key={group.label} className="nav-group">
            <div className="nav-group-label">{group.label}</div>
            {group.items.map(({ href, icon: Icon, key }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`nav-item${active ? ' active' : ''}`}
                >
                  <Icon className="nav-item-icon" />
                  <span>{t(key)}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button onClick={handleSignOut} className="sidebar-signout">
          <LogOut className="nav-item-icon" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
