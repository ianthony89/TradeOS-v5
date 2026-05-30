'use client'

import { useEffect, useCallback, useMemo } from 'react'
import { Sparkles, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useHoldingsStore } from '@/stores/holdings'
import { useMarketStore, selectActiveFxRate } from '@/stores/market'
import { useT } from '@/lib/i18n/context'
import { Panel, PanelHead, PanelBody } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { BarRace } from '@/components/ui/bar-race'
import { Constellation } from '@/components/ui/constellation'
import { getSector, getSectorColor } from '@/lib/portfolio/sectors'

/** USD-equivalent of a native amount (MYR ÷ FX). */
function usdEquiv(amt: number, currency: string, fx: number): number {
  return currency === 'MYR' ? amt / fx : amt
}

export default function LabPage() {
  const supabase = createClient()
  const t        = useT()
  const { holdings, setHoldings } = useHoldingsStore()
  const fxRate = useMarketStore(selectActiveFxRate)

  const loadHoldings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('holdings')
      .select('*')
      .eq('user_id', user.id)
      .order('market_value', { ascending: false })
    if (data) {
      setHoldings(data.map(row => ({
        id:               row.id,
        symbol:           row.symbol,
        symbolNormalized: row.symbol_normalized,
        name:             row.name ?? row.symbol,
        quantity:         Number(row.quantity),
        availableQty:     Number(row.available_qty ?? row.quantity),
        avgCost:          Number(row.avg_cost),
        currentPrice:     Number(row.current_price ?? row.avg_cost),
        marketValue:      Number(row.market_value ?? 0),
        unrealizedPl:     Number(row.unrealized_pl ?? 0),
        unrealizedPlPct:  Number(row.unrealized_pl_pct ?? 0),
        realizedPl:       Number(row.realized_pl ?? 0),
        todayPl:          Number(row.today_pl ?? 0),
        currency:         row.currency,
        assetType:        row.asset_type ?? 'US_EQUITY',
        sector:           row.sector,
        targetPrice:      row.target_price ? Number(row.target_price) : null,
        stopLoss:         row.stop_loss ? Number(row.stop_loss) : null,
        notes:            row.notes,
        portfolioWeight:  0,
        quotesUpdatedAt:  row.quotes_updated_at,
      })))
    }
  }, [supabase, setHoldings])

  useEffect(() => { if (!holdings.length) loadHoldings() }, [loadHoldings, holdings.length])

  const combined = useMemo(
    () => holdings.reduce((s, h) => s + usdEquiv(h.marketValue, h.currency, fxRate), 0),
    [holdings, fxRate],
  )

  const enriched = useMemo(
    () => holdings.map(h => {
      const usdValue = usdEquiv(h.marketValue, h.currency, fxRate)
      return { ...h, usdValue, weight: combined > 0 ? (usdValue / combined) * 100 : 0 }
    }),
    [holdings, combined, fxRate],
  )

  const raceItems = useMemo(
    () => enriched.map(h => ({ symbol: h.symbol, value: h.usdValue })),
    [enriched],
  )

  const stars = useMemo(
    () => enriched.map(h => {
      const sector = getSector(h.symbol, h.assetType)
      return { symbol: h.symbol, sector, weight: h.weight, color: getSectorColor(sector) }
    }),
    [enriched],
  )

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('nav_lab')}</h1>
          <p className="section-sub">{t('lab_sub')}</p>
        </div>
      </div>

      {!holdings.length ? (
        <Panel>
          <PanelBody>
            <EmptyState
              icon={<Sparkles size={20} />}
              title={t('lab_empty_title')}
              sub={t('lab_empty_sub')}
              actions={
                <a href="/holdings" className="btn btn-primary btn-sm">
                  <Upload size={13} />
                  {t('holdings_import')}
                </a>
              }
            />
          </PanelBody>
        </Panel>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Panel>
            <PanelHead title={t('lab_constellation')} meta={t('lab_constellation_meta')} />
            <PanelBody>
              <Constellation items={stars} />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead title={t('lab_barrace')} meta={t('lab_barrace_meta')} />
            <PanelBody>
              <BarRace items={raceItems} top={8} />
            </PanelBody>
          </Panel>
        </div>
      )}
    </div>
  )
}
