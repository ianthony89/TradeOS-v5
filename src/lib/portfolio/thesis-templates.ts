// ============================================================
//  TradeOS v5 — Thesis starter templates (Phase 2A)
//  Pick a thesis type and the four fields fill with a real first
//  draft (80-90% done) plus building-block chips you can append.
//  Template only, no AI. Bilingual content lives here (not the UI
//  dictionary), same pattern as stock-names.ts.
//  Voice: a real investor's own notes. No em dashes, no MBA-speak.
// ============================================================

export type ThesisType =
  | 'growth' | 'compounder' | 'value' | 'dividend' | 'turnaround'
  | 'speculation' | 'etf' | 'cyclical' | 'ai' | 'smallcap'

export interface ThesisTemplate {
  label:        string
  thesis:       string
  bullCase:     string
  bearCase:     string
  invalidation: string
  chips:        string[]   // 8-12 building blocks, appended on click
}

export const THESIS_TYPES: ThesisType[] = [
  'growth', 'compounder', 'value', 'dividend', 'turnaround',
  'speculation', 'etf', 'cyclical', 'ai', 'smallcap',
]

const EN: Record<ThesisType, ThesisTemplate> = {
  growth: {
    label: 'Growth',
    thesis: 'The company still has plenty of room to grow revenue over the next few years, and it is taking share in a large market.',
    bullCase: 'Revenue keeps growing faster than the market expects, and the stock re-rates higher as it does.',
    bearCase: 'Growth slows toward the market average and investors stop paying a premium for it.',
    invalidation: 'Revenue growth stalls for two or three quarters in a row with no clear reason.',
    chips: ['large market', 'taking market share', 'new products', 'international expansion', 'operating leverage', 'high gross margins', 'recurring revenue', 'founder-led', 'net cash on hand', 'pricing power', 'sticky customers', 'reinvesting heavily'],
  },
  compounder: {
    label: 'Compounder',
    thesis: 'This is a high-quality business I want to own for years and just let grow, because it puts its cash back to work at high returns.',
    bullCase: 'It keeps growing steadily year after year, so the position quietly becomes worth more over time.',
    bearCase: 'The returns it earns on cash fade as it gets bigger, and the steady growth slows down.',
    invalidation: 'Return on capital drops sharply, or management starts spending cash poorly.',
    chips: ['hard to compete with', 'high returns on cash', 'years of growth left', 'reinvests cash well', 'pricing power', 'recurring revenue', 'low debt', 'buys back stock', 'loyal customers', 'strong brand', 'owner-operator', 'steady free cash flow'],
  },
  value: {
    label: 'Value',
    thesis: 'The stock looks clearly cheaper than what the business is actually worth today, so I am buying the gap.',
    bullCase: 'The market notices the value and the price moves up to meet it, or the company returns cash to get there.',
    bearCase: 'It stays cheap because the business keeps getting weaker, so it was cheap for a reason.',
    invalidation: 'Earnings and cash flow keep falling, which means the low price is deserved.',
    chips: ['trades below book', 'low P/E', 'lots of cash', 'buying back stock', 'assets worth more', 'out of favor', 'insider buying', 'could be acquired', 'strong balance sheet', 'temporary problem', 'high free cash flow yield', 'paying down debt'],
  },
  dividend: {
    label: 'Dividend',
    thesis: 'I hold this mainly for a steady, growing dividend that the company can clearly afford to keep paying.',
    bullCase: 'The dividend keeps growing and stays well covered by cash flow, so I get paid to wait.',
    bearCase: 'Cash flow weakens and the dividend starts to look stretched or at risk.',
    invalidation: 'The company cuts or suspends the dividend.',
    chips: ['covered by cash flow', 'long payout history', 'growing dividend', 'low payout ratio', 'stable business', 'strong balance sheet', 'defensive sector', 'high yield', 'buybacks too', 'pricing power', 'recession-resistant', 'reliable cash flow'],
  },
  turnaround: {
    label: 'Turnaround',
    thesis: 'This is a beaten-down business with a real chance to recover, and I think the worst is close to behind it.',
    bullCase: 'The fix works, margins and profits start coming back, and the stock re-rates as confidence returns.',
    bearCase: 'The recovery never really arrives and the business keeps sliding.',
    invalidation: 'Several quarters pass with no sign of improvement in the numbers.',
    chips: ['new management', 'cutting costs', 'selling weak units', 'debt coming down', 'new product cycle', 'worst is priced in', 'insider buying', 'margins bottoming', 'fresh strategy', 'balance sheet fixed', 'demand recovering', 'low expectations'],
  },
  speculation: {
    label: 'Speculation',
    thesis: 'This is a small, high-risk bet that one specific thing goes right, and I am sizing it so a loss will not hurt much.',
    bullCase: 'That one thing happens and the stock re-rates sharply higher.',
    bearCase: 'It does not play out and most of the money I put in is at risk.',
    invalidation: 'It becomes clear the bet is not going to work, or the catalyst gets pushed out indefinitely.',
    chips: ['binary catalyst', 'small position', 'high upside', 'could go to zero', 'early stage', 'story stock', 'needs funding', 'high short interest', 'lottery ticket', 'news-driven', 'wide range of outcomes', 'tight stop'],
  },
  etf: {
    label: 'ETF',
    thesis: 'I own this fund for broad, low-cost exposure to a market or theme, so I do not have to pick single winners.',
    bullCase: 'The whole basket drifts higher over time and I capture the average return without single-stock risk.',
    bearCase: 'The market or theme stays flat or falls, and the fund drops with it.',
    invalidation: 'The long-term reason I bought the theme no longer holds, or fees and tracking get too high.',
    chips: ['broad diversification', 'low fees', 'passive index', 'core holding', 'long-term hold', 'dollar-cost average', 'whole sector', 'no single-stock risk', 'liquid', 'tax efficient', 'rebalances itself', 'theme exposure'],
  },
  cyclical: {
    label: 'Cyclical',
    thesis: 'I am buying this cyclical business near the low point of its cycle, expecting demand and prices to recover.',
    bullCase: 'The cycle turns up, demand and prices recover, and earnings jump off a low base.',
    bearCase: 'The downturn lasts longer than expected and earnings stay depressed.',
    invalidation: 'The cycle keeps getting worse, or it turns out to be a structural decline rather than a cycle.',
    chips: ['bottom of cycle', 'demand recovering', 'prices rising', 'low inventories', 'operating leverage', 'cheap on normal earnings', 'supply tightening', 'early cyclical', 'balance sheet can wait', 'margins bottoming', 'high beta', 'macro-driven'],
  },
  ai: {
    label: 'AI Theme',
    thesis: 'I own this as a way to play the shift toward AI, where I think spending and adoption keep rising for years.',
    bullCase: 'AI demand keeps growing and this company captures a real, growing share of that spending.',
    bearCase: 'AI spending slows or commoditizes, and this company turns out not to be a key winner.',
    invalidation: 'The company loses its edge in AI, or the AI demand it depends on clearly rolls over.',
    chips: ['AI adoption', 'rising AI spend', 'real revenue not hype', 'key supplier', 'data advantage', 'pricing power', 'early leader', 'compute demand', 'software margins', 'hard to switch away', 'long-term shift', 'broad customer base'],
  },
  smallcap: {
    label: 'Small Cap',
    thesis: 'This is a small company that is still under the radar, and I think it can grow a lot before the market pays attention.',
    bullCase: 'It keeps executing and growing, and the stock re-rates as more investors discover it.',
    bearCase: 'Growth disappoints, or being small and thinly traded makes the stock swing hard against me.',
    invalidation: 'Growth stalls, the balance sheet gets stretched, or the original reason to own it breaks.',
    chips: ['under the radar', 'founder-led', 'room to grow', 'little coverage', 'could get acquired', 'niche leader', 'insider ownership', 'thinly traded', 'self-funded', 'reinvesting profits', 'early in its story', 'high growth'],
  },
}

const ZH: Record<ThesisType, ThesisTemplate> = {
  growth: {
    label: '成长',
    thesis: '这家公司未来几年还有很大的营收增长空间,而且正在一个大市场里抢份额。',
    bullCase: '营收持续增长得比市场预期更快,股价也随之上修。',
    bearCase: '增长放缓到接近行业平均,投资者不再愿意为它付溢价。',
    invalidation: '营收连续两三个季度不再增长,而且找不到明确原因。',
    chips: ['大市场', '抢占份额', '新产品', '海外扩张', '经营杠杆', '高毛利', '经常性收入', '创始人掌舵', '账上有净现金', '定价权', '客户粘性', '积极再投资'],
  },
  compounder: {
    label: '复利',
    thesis: '这是一门高质量的生意,我想拿很多年、让它慢慢长大,因为它能把现金以高回报再投出去。',
    bullCase: '它年复一年稳定增长,这个仓位会悄悄变得越来越值钱。',
    bearCase: '随着体量变大,它在现金上赚到的回报下降,稳定的增长也放慢。',
    invalidation: '资本回报率大幅下滑,或者管理层开始乱花钱。',
    chips: ['难以被竞争', '现金回报高', '还有多年增长', '现金再投得好', '定价权', '经常性收入', '低负债', '持续回购', '客户忠诚', '品牌强', '老板心态', '稳定自由现金流'],
  },
  value: {
    label: '价值',
    thesis: '股价明显比这家公司现在实际值的便宜,我买的就是这个差价。',
    bullCase: '市场注意到它的价值,股价向价值靠拢,或公司通过分红回购把价值还给股东。',
    bearCase: '它一直便宜,是因为生意在持续变弱,便宜有便宜的道理。',
    invalidation: '盈利和现金流持续下滑,说明这个低价是应得的。',
    chips: ['低于账面价值', '低市盈率', '现金充裕', '正在回购', '资产更值钱', '不受市场待见', '内部人增持', '可能被收购', '资产负债表稳健', '问题是暂时的', '自由现金流收益率高', '在还债'],
  },
  dividend: {
    label: '股息',
    thesis: '持有它主要是为了一份稳定、还在增长、公司明显付得起的股息。',
    bullCase: '股息持续增长,而且被现金流稳稳覆盖,等的过程中我一直有钱拿。',
    bearCase: '现金流走弱,股息开始显得紧张、有被砍的风险。',
    invalidation: '公司削减或暂停了股息。',
    chips: ['现金流覆盖', '长期派息记录', '股息在增长', '派息率低', '生意稳定', '资产负债表稳健', '防御性行业', '高股息率', '也在回购', '定价权', '抗衰退', '现金流可靠'],
  },
  turnaround: {
    label: '反转',
    thesis: '这是一家被打压的公司,有真实的复苏机会,我认为最糟的阶段快过去了。',
    bullCase: '整改见效,利润率和利润开始回来,信心恢复带动股价重估。',
    bearCase: '复苏始终没真正到来,生意继续往下滑。',
    invalidation: '好几个季度过去,数字上仍看不到改善迹象。',
    chips: ['新管理层', '削减成本', '卖掉弱业务', '负债在下降', '新产品周期', '最坏已反映', '内部人增持', '利润率见底', '全新策略', '资产负债表已修复', '需求在恢复', '市场预期很低'],
  },
  speculation: {
    label: '投机',
    thesis: '这是一笔押某件具体事情成真的小额高风险仓位,我控制好仓位,亏了也不至于伤筋动骨。',
    bullCase: '那件事成真,股价快速大幅重估。',
    bearCase: '没成,我投进去的大部分钱都有风险。',
    invalidation: '已经能看出这个赌注成不了,或催化剂被无限期推迟。',
    chips: ['二元催化剂', '小仓位', '上行空间大', '可能归零', '早期阶段', '故事型股票', '需要融资', '高做空比例', '彩票式机会', '消息驱动', '结果差异极大', '止损要紧'],
  },
  etf: {
    label: 'ETF',
    thesis: '我买这只基金是为了低成本、广泛地暴露在某个市场或主题上,不用去挑单个赢家。',
    bullCase: '整篮子随时间上行,我拿到平均回报,又避开了单只股票的风险。',
    bearCase: '这个市场或主题不涨甚至下跌,基金跟着回落。',
    invalidation: '当初看好这个主题的长期理由不再成立,或费用和跟踪误差变得太高。',
    chips: ['广泛分散', '费用低', '被动指数', '核心持仓', '长期持有', '定投', '整个行业', '无单股风险', '流动性好', '税务高效', '自动再平衡', '主题暴露'],
  },
  cyclical: {
    label: '周期',
    thesis: '我在这门周期性生意接近周期低点时买入,预期需求和价格会回升。',
    bullCase: '周期向上,需求和价格回升,利润从低基数上大幅跳升。',
    bearCase: '下行持续的时间比预期更长,利润长期低迷。',
    invalidation: '周期继续恶化,或者发现这其实是结构性衰退、不是周期。',
    chips: ['周期低点', '需求恢复', '价格上行', '库存很低', '经营杠杆', '按正常盈利算便宜', '供给收紧', '早周期', '资产负债表撑得住', '利润率见底', '高贝塔', '宏观驱动'],
  },
  ai: {
    label: 'AI 主题',
    thesis: '我把它当作押注 AI 大趋势的一种方式,我认为相关投入和普及会持续好几年。',
    bullCase: 'AI 需求持续增长,这家公司在这块支出里拿到真实且不断扩大的份额。',
    bearCase: 'AI 支出放缓或变成同质化竞争,而这家公司其实算不上关键赢家。',
    invalidation: '公司在 AI 上的优势丢失,或它依赖的 AI 需求明显见顶回落。',
    chips: ['AI 普及', 'AI 投入增加', '真实收入而非概念', '关键供应商', '数据优势', '定价权', '早期领先', '算力需求', '软件高毛利', '难以替换', '长期趋势', '客户基础广'],
  },
  smallcap: {
    label: '小盘',
    thesis: '这是一家还没被关注到的小公司,我认为它能在市场注意到之前长大很多。',
    bullCase: '它持续把事做成、保持增长,随着更多投资者发现它,股价重估。',
    bearCase: '增长不及预期,或者因为盘子小、成交清淡,股价会剧烈波动反噬我。',
    invalidation: '增长停滞,资产负债表被拉紧,或当初持有的理由不再成立。',
    chips: ['不被关注', '创始人掌舵', '成长空间大', '几乎没研报覆盖', '可能被收购', '细分龙头', '内部人持股', '成交清淡', '自给自足', '利润再投入', '故事还很早', '高增长'],
  },
}

export function thesisTemplate(type: ThesisType, lang: 'en' | 'zh'): ThesisTemplate {
  return (lang === 'zh' ? ZH : EN)[type]
}
