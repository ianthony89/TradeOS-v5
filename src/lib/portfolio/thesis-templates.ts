// ============================================================
//  TradeOS v5 — Thesis starter templates (Phase 2A)
//  Pick a thesis type → prefill the 4 fields with a starter
//  structure the user then edits. Template only — no AI.
//  Bilingual content lives here (not the UI dictionary), same
//  pattern as stock-names.ts.
// ============================================================

export type ThesisType = 'growth' | 'value' | 'income' | 'turnaround' | 'speculation'

export interface ThesisTemplate {
  label:        string
  thesis:       string
  bullCase:     string
  bearCase:     string
  invalidation: string
}

export const THESIS_TYPES: ThesisType[] = ['growth', 'value', 'income', 'turnaround', 'speculation']

const EN: Record<ThesisType, ThesisTemplate> = {
  growth: {
    label: 'Growth',
    thesis: 'Revenue can still grow for many years.',
    bullCase: 'Revenue keeps growing and margins improve.',
    bearCase: 'Competitors take market share.',
    invalidation: 'Sales stop growing.',
  },
  value: {
    label: 'Value',
    thesis: 'The stock is cheaper than the business is worth.',
    bullCase: 'The market wakes up and the price catches up.',
    bearCase: 'It stays cheap because the business is weak.',
    invalidation: 'The business keeps getting worse.',
  },
  income: {
    label: 'Income',
    thesis: 'I own it for a steady, well-covered dividend.',
    bullCase: 'The dividend keeps growing.',
    bearCase: 'The dividend gets cut.',
    invalidation: 'They cut or stop the dividend.',
  },
  turnaround: {
    label: 'Turnaround',
    thesis: 'A beaten-down business that can recover.',
    bullCase: 'The fix works and profits come back.',
    bearCase: 'The turnaround does not happen.',
    invalidation: 'No improvement after a few quarters.',
  },
  speculation: {
    label: 'Speculation',
    thesis: 'A small, high-risk bet on one thing going right.',
    bullCase: 'That one thing happens and the stock jumps.',
    bearCase: 'It does not work out and I lose money.',
    invalidation: 'The bet clearly fails.',
  },
}

const ZH: Record<ThesisType, ThesisTemplate> = {
  growth: {
    label: '成长',
    thesis: '营收还能再增长很多年。',
    bullCase: '营收继续增长,利润率改善。',
    bearCase: '竞争对手抢走市场份额。',
    invalidation: '销售停止增长。',
  },
  value: {
    label: '价值',
    thesis: '股价比这家公司实际值的便宜。',
    bullCase: '市场反应过来,股价补涨。',
    bearCase: '便宜是因为公司本身不行。',
    invalidation: '公司经营持续变差。',
  },
  income: {
    label: '股息',
    thesis: '为了稳定、覆盖得起的股息而持有。',
    bullCase: '股息持续增长。',
    bearCase: '股息被削减。',
    invalidation: '他们削减或停发股息。',
  },
  turnaround: {
    label: '反转',
    thesis: '被打压的业务,有机会复苏。',
    bullCase: '整改见效,利润回来了。',
    bearCase: '复苏没有发生。',
    invalidation: '几个季度后还是没改善。',
  },
  speculation: {
    label: '投机',
    thesis: '押一件事情成真的小额高风险仓位。',
    bullCase: '那件事成真,股价大涨。',
    bearCase: '没成,亏钱。',
    invalidation: '这个赌注明显失败了。',
  },
}

export function thesisTemplate(type: ThesisType, lang: 'en' | 'zh'): ThesisTemplate {
  return (lang === 'zh' ? ZH : EN)[type]
}
