'use client'

import { Bot } from 'lucide-react'
import { Panel, PanelBody } from '@/components/ui/panel'
import { ComingSoon }       from '@/components/ui/coming-soon'
import { useT }             from '@/lib/i18n/context'

export default function AiPage() {
  const t = useT()
  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('nav_ai')}</h1>
          <p className="section-sub">{t('soon_ai_desc')}</p>
        </div>
      </div>
      <Panel>
        <PanelBody>
          <ComingSoon
            icon={<Bot size={22} />}
            title={t('soon_ai_title')}
            desc={t('soon_ai_desc')}
            badge={t('soon_badge')}
            roadmapLabel={t('soon_roadmap')}
            roadmap={[t('soon_ai_r1'), t('soon_ai_r2'), t('soon_ai_r3')]}
          />
        </PanelBody>
      </Panel>
    </div>
  )
}
