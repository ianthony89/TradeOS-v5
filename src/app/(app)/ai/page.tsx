'use client'

import { Bot } from 'lucide-react'
import { Panel, PanelBody } from '@/components/ui/panel'
import { EmptyState }       from '@/components/ui/empty-state'
import { useT }             from '@/lib/i18n/context'

export default function AiPage() {
  const t = useT()
  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('nav_ai')}</h1>
          <p className="section-sub">AI portfolio insights</p>
        </div>
      </div>
      <Panel>
        <PanelBody>
          <EmptyState
            icon={<Bot size={20} />}
            title="AI insights coming soon"
            sub="Bring your own key — Gemini / OpenAI. Position analysis, news summaries, scenario planning."
          />
        </PanelBody>
      </Panel>
    </div>
  )
}
