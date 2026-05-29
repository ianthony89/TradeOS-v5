'use client'

import { BookOpen } from 'lucide-react'
import { Panel, PanelBody } from '@/components/ui/panel'
import { ComingSoon }       from '@/components/ui/coming-soon'
import { useT }             from '@/lib/i18n/context'

export default function JournalPage() {
  const t = useT()
  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('nav_journal')}</h1>
          <p className="section-sub">{t('soon_journal_desc')}</p>
        </div>
      </div>
      <Panel>
        <PanelBody>
          <ComingSoon
            icon={<BookOpen size={22} />}
            title={t('soon_journal_title')}
            desc={t('soon_journal_desc')}
            badge={t('soon_badge')}
            roadmapLabel={t('soon_roadmap')}
            roadmap={[t('soon_journal_r1'), t('soon_journal_r2'), t('soon_journal_r3')]}
          />
        </PanelBody>
      </Panel>
    </div>
  )
}
