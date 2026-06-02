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
    thesis: 'The company still has room to grow revenue over the next few years.',
    bullCase: 'Revenue grows faster than the market expects and the stock re-rates higher.',
    bearCase: 'Growth slows down and investors lose interest in the story.',
    invalidation: 'Revenue stops growing for several quarters in a row.',
  },
  value: {
    label: 'Value',
    thesis: 'The stock looks cheaper than what the business is actually worth today.',
    bullCase: 'The market notices the value and the price moves up to meet it.',
    bearCase: 'It stays cheap because the business keeps getting weaker.',
    invalidation: 'Earnings and cash flow keep falling, so the low price is deserved.',
  },
  income: {
    label: 'Income',
    thesis: 'I hold this for a steady dividend that the company can clearly afford.',
    bullCase: 'The dividend keeps growing and stays well covered by cash flow.',
    bearCase: 'Cash flow weakens and the dividend starts to look less safe.',
    invalidation: 'The company cuts or suspends the dividend.',
  },
  turnaround: {
    label: 'Turnaround',
    thesis: 'A beaten-down business with a real chance to recover from here.',
    bullCase: 'The turnaround plan works and profits start coming back.',
    bearCase: 'The recovery never really happens and the decline keeps going.',
    invalidation: 'Several quarters pass with no sign of improvement.',
  },
  speculation: {
    label: 'Speculation',
    thesis: 'A small, high-risk bet that one specific thing goes right.',
    bullCase: 'That one thing happens and the stock re-rates sharply.',
    bearCase: 'It does not play out and most of the money is at risk.',
    invalidation: 'It becomes clear the bet is not going to work.',
  },
}

const ZH: Record<ThesisType, ThesisTemplate> = {
  growth: {
    label: '成长',
    thesis: '这家公司未来几年还有把营收做大的空间。',
    bullCase: '营收增长得比市场预期更快,股价随之上修。',
    bearCase: '增长放缓,投资者对这个故事失去兴趣。',
    invalidation: '营收连续好几个季度不再增长。',
  },
  value: {
    label: '价值',
    thesis: '股价看起来比这家公司现在实际值的要便宜。',
    bullCase: '市场注意到它的价值,股价向价值靠拢。',
    bearCase: '一直便宜,是因为公司在持续变弱。',
    invalidation: '盈利和现金流持续下滑,这个低价是应得的。',
  },
  income: {
    label: '股息',
    thesis: '持有它是为了一份公司明显付得起的稳定股息。',
    bullCase: '股息持续增长,而且被现金流稳稳覆盖。',
    bearCase: '现金流走弱,股息开始显得没那么安全。',
    invalidation: '公司削减或暂停了股息。',
  },
  turnaround: {
    label: '反转',
    thesis: '一家被打压的公司,从现在起有真实的复苏机会。',
    bullCase: '整改计划见效,利润开始回来。',
    bearCase: '复苏始终没真正发生,继续往下走。',
    invalidation: '好几个季度过去,仍看不到改善的迹象。',
  },
  speculation: {
    label: '投机',
    thesis: '押某一件具体的事情成真的小额高风险仓位。',
    bullCase: '那件事成真,股价快速重估。',
    bearCase: '没成,大部分本金都有风险。',
    invalidation: '已经能看出这个赌注成不了。',
  },
}

export function thesisTemplate(type: ThesisType, lang: 'en' | 'zh'): ThesisTemplate {
  return (lang === 'zh' ? ZH : EN)[type]
}
