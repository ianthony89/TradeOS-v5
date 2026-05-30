'use client'

export interface RiskFactor { label: string; weight: number; value: number }

interface RiskGaugeProps {
  factors:      RiskFactor[]
  /** 'full' shows the score gauge + factors. 'factors' shows only the
   *  factor breakdown (use when the score already lives in a stat card). */
  variant?:     'full' | 'factors'
  score?:       number
  levelLabel?:  string
  levelTone?:   'positive' | 'warning' | 'negative'
  scaleLabels?: [string, string, string]   // low · moderate · high
}

/**
 * Risk detail. In 'factors' mode it shows only what drives the score
 * (concentration / speculative / drawdown × weight) — the number itself
 * is shown in the Risk Score stat card, so we don't repeat it here.
 */
export function RiskGauge({
  factors, variant = 'full', score = 0, levelLabel = '', levelTone = 'warning', scaleLabels,
}: RiskGaugeProps) {
  const toneColor =
    levelTone === 'positive' ? 'var(--positive)' :
    levelTone === 'negative' ? 'var(--negative)' : 'var(--warning)'

  return (
    <div className="rg">
      {variant === 'full' && (
        <>
          <div className="rg-top">
            <div className="rg-num">{score}<small>/100</small></div>
            <div className="rg-level" style={{ color: toneColor }}>{levelLabel}</div>
          </div>
          <div className="rg-bar">
            <div className="rg-marker" style={{ left: `${Math.min(98, Math.max(2, score))}%` }} />
          </div>
          {scaleLabels && (
            <div className="rg-scale">
              <span>{scaleLabels[0]}</span>
              <span>{scaleLabels[1]}</span>
              <span>{scaleLabels[2]}</span>
            </div>
          )}
        </>
      )}

      <div className="rg-factors" style={variant === 'factors' ? { marginTop: 0 } : undefined}>
        {factors.map(f => (
          <div key={f.label} className="rg-factor">
            <span className="rg-factor-label">{f.label}</span>
            <div className="rg-factor-track">
              <div className="rg-factor-fill" style={{ width: `${f.value}%` }} />
            </div>
            <span className="rg-factor-weight text-tabular">×{f.weight.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
