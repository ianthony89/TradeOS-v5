import type { ReactNode } from 'react'

interface PanelProps {
  children:   ReactNode
  className?: string
}

/** Glass panel — base container for all dashboard cards. */
export function Panel({ children, className = '' }: PanelProps) {
  return <div className={`panel ${className}`}>{children}</div>
}

interface PanelHeadProps {
  title:     ReactNode
  meta?:     ReactNode
  actions?:  ReactNode
  className?: string
}

export function PanelHead({ title, meta, actions, className = '' }: PanelHeadProps) {
  return (
    <div className={`panel-head ${className}`}>
      <div className="panel-title">{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {meta && <span className="panel-meta">{meta}</span>}
        {actions}
      </div>
    </div>
  )
}

interface PanelBodyProps {
  children:   ReactNode
  className?: string
  /** Remove padding (for tables / lists that own their own spacing). */
  flush?:     boolean
}

export function PanelBody({ children, className = '', flush = false }: PanelBodyProps) {
  return (
    <div className={`panel-body${flush ? ' panel-body--flush' : ''} ${className}`}>
      {children}
    </div>
  )
}
