'use client'

import { Calculator } from 'lucide-react'
import { Panel, PanelBody } from '@/components/ui/panel'
import { EmptyState }       from '@/components/ui/empty-state'
import { useT }             from '@/lib/i18n/context'

export default function PlannerPage() {
  const t = useT()
  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('nav_planner')}</h1>
          <p className="section-sub">Position sizing & risk planning</p>
        </div>
      </div>
      <Panel>
        <PanelBody>
          <EmptyState
            icon={<Calculator size={20} />}
            title="Planner coming soon"
            sub="Pre-trade calculator: position size, R-multiples, stop placement, target ratios."
          />
        </PanelBody>
      </Panel>
    </div>
  )
}
