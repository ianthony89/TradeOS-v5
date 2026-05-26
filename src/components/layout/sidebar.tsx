'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Briefcase, Eye, BookOpen,
  Calculator, Bot, Settings, LogOut,
} from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV = [
  { href: '/dashboard',   icon: LayoutDashboard, key: 'nav_dashboard'  },
  { href: '/holdings',    icon: Briefcase,        key: 'nav_holdings'   },
  { href: '/watchlist',   icon: Eye,              key: 'nav_watchlist'  },
  { href: '/journal',     icon: BookOpen,         key: 'nav_journal'    },
  { href: '/planner',     icon: Calculator,       key: 'nav_planner'    },
  { href: '/ai',          icon: Bot,              key: 'nav_ai'         },
  { href: '/settings',    icon: Settings,         key: 'nav_settings'   },
]

export function Sidebar() {
  const pathname = usePathname()
  const t        = useT()
  const router   = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">TradeOS</div>

      <div className="flex-1 py-2">
        {NAV.map(({ href, icon: Icon, key }) => (
          <Link
            key={href}
            href={href}
            className={`nav-item ${pathname.startsWith(href) ? 'active' : ''}`}
          >
            <Icon size={16} />
            <span>{t(key)}</span>
          </Link>
        ))}
      </div>

      <div className="py-2 border-t border-[var(--border)]">
        <button onClick={handleSignOut} className="nav-item w-full text-left">
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </nav>
  )
}
