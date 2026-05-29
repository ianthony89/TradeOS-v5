'use client'

import { Calculator } from 'lucide-react'
import { Panel, PanelBody } from '@/components/ui/panel'
import { ComingSoon }       from '@/components/ui/coming-soon'
import { useT }             from '@/lib/i18n/context'

export default function PlannerPage() {
  const t = useT()
  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('nav_planner')}</h1>
          <p className="section-sub">{t('soon_planner_desc')}</p>
        </div>
      </div>
      <Panel>
        <PanelBody>
          <ComingSoon
            icon={<Calculator size={22} />}
            title={t('soon_planner_title')}
            desc={t('soon_planner_desc')}
            badge={t('soon_badge')}
            roadmapLabel={t('soon_roadmap')}
            roadmap={[t('soon_planner_r1'), t('soon_planner_r2'), t('soon_planner_r3')]}
          />
        </PanelBody>
      </Panel>
    </div>
  )
}
