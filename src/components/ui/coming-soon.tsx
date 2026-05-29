import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

interface ComingSoonProps {
  icon:      ReactNode
  title:     string
  desc:      string
  badge:     string
  roadmapLabel: string
  roadmap:   string[]
}

/**
 * Phase-2 roadmap card. Honest "coming soon" — shows what the module
 * will do, not a fake working shell. Used by Journal / Planner / AI.
 */
export function ComingSoon({
  icon, title, desc, badge, roadmapLabel, roadmap,
}: ComingSoonProps) {
  return (
    <div className="coming-soon">
      <div className="coming-soon-icon">{icon}</div>
      <div className="coming-soon-badge">{badge}</div>
      <h2 className="coming-soon-title">{title}</h2>
      <p className="coming-soon-desc">{desc}</p>

      <div className="coming-soon-roadmap">
        <div className="coming-soon-roadmap-label">{roadmapLabel}</div>
        <ul className="coming-soon-list">
          {roadmap.map((item, i) => (
            <li key={i} className="coming-soon-list-item">
              <span className="coming-soon-check"><Check size={12} /></span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
