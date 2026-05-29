'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Briefcase, Eye, Bot, Settings } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

const MOBILE_NAV = [
  { href: '/dashboard', icon: LayoutDashboard, key: 'nav_dashboard' },
  { href: '/holdings',  icon: Briefcase,       key: 'nav_holdings'  },
  { href: '/watchlist', icon: Eye,             key: 'nav_watchlist' },
  { href: '/ai',        icon: Bot,             key: 'nav_ai'        },
  { href: '/settings',  icon: Settings,        key: 'nav_settings'  },
] as const

export function MobileNav() {
  const pathname = usePathname()
  const t        = useT()

  return (
    <nav className="mobile-nav">
      {MOBILE_NAV.map(({ href, icon: Icon, key }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link key={href} href={href} className={`mobile-nav-item${active ? ' active' : ''}`}>
            <Icon size={18} />
            <span>{t(key)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
