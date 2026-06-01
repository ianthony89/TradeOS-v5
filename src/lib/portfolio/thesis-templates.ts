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
    thesis: 'Long runway for growth in a large, expanding market.',
    bullCase: 'Revenue keeps compounding and margins scale with size.',
    bearCase: 'Growth slows or competition compresses margins.',
    invalidation: 'Revenue growth stalls for several quarters.',
  },
  value: {
    label: 'Value',
    thesis: 'Trading below intrinsic value — the market is mispricing it.',
    bullCase: 'The multiple re-rates as the value is recognised.',
    bearCase: 'It is a value trap — cheap for a reason.',
    invalidation: 'Fundamentals deteriorate and the discount is justified.',
  },
  income: {
    label: 'Income',
    thesis: 'Reliable dividend income with a well-covered payout.',
    bullCase: 'The dividend grows and stays covered by cash flow.',
    bearCase: 'The payout is cut or cash flow weakens.',
    invalidation: 'The dividend is reduced or suspended.',
  },
  turnaround: {
    label: 'Turnaround',
    thesis: 'Beaten-down business with a credible path to recovery.',
    bullCase: 'Restructuring works and margins recover.',
    bearCase: 'The turnaround stalls or the decline is structural.',
    invalidation: 'No operational improvement after several quarters.',
  },
  speculation: {
    label: 'Speculation',
    thesis: 'High-risk, high-reward bet on an emerging catalyst.',
    bullCase: 'The catalyst plays out and re-rates the stock.',
    bearCase: 'The thesis is early or wrong — capital is at risk.',
    invalidation: 'The catalyst fails to materialise.',
  },
}

const ZH: Record<ThesisType, ThesisTemplate> = {
  growth: {
    label: '成长',
    thesis: '处在又大又在扩张的市场,增长空间还很长。',
    bullCase: '营收持续复利增长,规模带动利润率提升。',
    bearCase: '增长放缓,或竞争压缩利润率。',
    invalidation: '营收增长连续多个季度停滞。',
  },
  value: {
    label: '价值',
    thesis: '股价低于内在价值,市场定价错误。',
    bullCase: '价值被认可,估值倍数修复。',
    bearCase: '其实是价值陷阱,便宜有便宜的道理。',
    invalidation: '基本面恶化,折价变得合理。',
  },
  income: {
    label: '股息',
    thesis: '稳定的股息收入,派息覆盖良好。',
    bullCase: '股息增长,且持续被现金流覆盖。',
    bearCase: '派息被削减,或现金流走弱。',
    invalidation: '股息被下调或暂停。',
  },
  turnaround: {
    label: '反转',
    thesis: '被打压的业务,有可信的复苏路径。',
    bullCase: '重组见效,利润率回升。',
    bearCase: '反转停滞,或衰退其实是结构性的。',
    invalidation: '多个季度后经营仍无改善。',
  },
  speculation: {
    label: '投机',
    thesis: '押注一个新兴催化剂的高风险高回报。',
    bullCase: '催化剂兑现,股价重估。',
    bearCase: '逻辑过早或看错,本金有风险。',
    invalidation: '催化剂最终没有兑现。',
  },
}

export function thesisTemplate(type: ThesisType, lang: 'en' | 'zh'): ThesisTemplate {
  return (lang === 'zh' ? ZH : EN)[type]
}
