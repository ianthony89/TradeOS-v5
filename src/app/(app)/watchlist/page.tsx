'use client'

import { Eye } from 'lucide-react'
import { Panel, PanelBody } from '@/components/ui/panel'
import { EmptyState }       from '@/components/ui/empty-state'
import { useT }             from '@/lib/i18n/context'

export default function WatchlistPage() {
  const t = useT()
  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('nav_watchlist')}</h1>
          <p className="section-sub">Track symbols you don&apos;t own yet</p>
        </div>
      </div>
      <Panel>
        <PanelBody>
          <EmptyState
            icon={<Eye size={20} />}
            title="Watchlist coming soon"
            sub="Add symbols, set price alerts, and get notified when targets are hit."
          />
        </PanelBody>
      </Panel>
    </div>
  )
}
