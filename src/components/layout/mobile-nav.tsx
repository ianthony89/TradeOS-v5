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
]

export function MobileNav() {
  const pathname = usePathname()
  const t        = useT()

  return (
    <nav className="bottom-nav">
      {MOBILE_NAV.map(({ href, icon: Icon, key }) => (
        <Link
          key={href}
          href={href}
          className={`bottom-nav-item ${pathname.startsWith(href) ? 'active' : ''}`}
        >
          <Icon size={20} />
          <span>{t(key)}</span>
        </Link>
      ))}
    </nav>
  )
}
