'use client'

import { BookOpen } from 'lucide-react'
import { Panel, PanelBody } from '@/components/ui/panel'
import { EmptyState }       from '@/components/ui/empty-state'
import { useT }             from '@/lib/i18n/context'

export default function JournalPage() {
  const t = useT()
  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('nav_journal')}</h1>
          <p className="section-sub">Log decisions, reasoning, lessons</p>
        </div>
      </div>
      <Panel>
        <PanelBody>
          <EmptyState
            icon={<BookOpen size={20} />}
            title="Trading journal coming soon"
            sub="Capture trade thesis, P/L lessons, and weekly reviews — all linked to your positions."
          />
        </PanelBody>
      </Panel>
    </div>
  )
}
