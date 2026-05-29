// ============================================================
//  TradeOS v5 — i18n Dictionary (EN + ZH)
// ============================================================

export type Lang = 'en' | 'zh'

type Dict = Record<string, string>

const en: Dict = {
  // ── App ─────────────────────────────────────────────────
  app_name:              'TradeOS',

  // ── Auth ────────────────────────────────────────────────
  auth_welcome:          'Welcome to TradeOS',
  auth_email:            'Email',
  auth_pin:              'Enter PIN',
  auth_create_pin:       'Create PIN',
  auth_confirm_pin:      'Confirm PIN',
  auth_pin_mismatch:     'PINs do not match',
  auth_pin_wrong:        'Incorrect PIN',
  auth_sign_in:          'Sign In',
  auth_signing_in:       'Signing in…',
  auth_invite_code:      'Invite Code',
  auth_invite_invalid:   'Invalid or expired invite code',
  auth_register:         'Create Account',
  auth_have_account:     'Already have an account?',
  auth_need_account:     'Need an account?',
  auth_your_name:        'Your name',
  auth_lock:             'Lock',
  auth_locked:           'App Locked',
  auth_unlock:           'Unlock',

  // ── Nav ─────────────────────────────────────────────────
  nav_dashboard:         'Dashboard',
  nav_holdings:          'Holdings',
  nav_watchlist:         'Watchlist',
  nav_journal:           'Journal',
  nav_planner:           'Planner',
  nav_ai:                'AI Analysis',
  nav_settings:          'Settings',

  // ── Greetings ────────────────────────────────────────────
  greeting_morning:      'Good Morning',
  greeting_afternoon:    'Good Afternoon',
  greeting_evening:      'Good Evening',

  // ── Market state ─────────────────────────────────────────
  market_open:           'Open',
  market_closed:         'Closed',
  market_pre:            'Pre-Market',
  market_pre_market:     'Pre-market',
  market_pre_open:       'Pre-open',
  market_morning:        'Morning',
  market_lunch:          'Lunch break',
  market_afternoon:      'Afternoon',
  market_after_hours:    'After-hours',
  market_overnight:      'Overnight',
  market_post:           'After-Hours',
  market_holiday:        'Market Holiday',
  market_closed_today:   'Market closed today',

  // ── Strategy / Health / Action ───────────────────────────
  tax_CORE:              'Core',
  tax_TACTICAL:          'Tactical',
  tax_SPECULATIVE:       'Speculative',
  tax_HEALTHY:           'Healthy',
  tax_WEAK:              'Weak',
  tax_DEAD:              'Dead',
  tax_HOLD:              'Hold',
  tax_ADD:               'Add',
  tax_REDUCE:            'Reduce',
  tax_EXIT:              'Exit',

  // ── Dashboard intelligence ───────────────────────────────
  dash_sector_alloc:     'Sector allocation',
  dash_movers:           'Top movers',
  dash_pulse:            'Market pulse',
  dash_intel:            'Portfolio signals',
  dash_concentration:    '{symbol} is {pct} of portfolio',
  dash_concentration_d:  'Above 25% concentration — consider trimming',
  dash_dead_pos:         '{symbol} down {pct}',
  dash_dead_pos_d:       'Heavy loss — review thesis or exit',
  dash_sector_heavy:     '{sector} sector is {pct} of portfolio',
  dash_sector_heavy_d:   'Heavy single-sector concentration',
  col_strategy:          'Strategy',
  col_action:            'Action',

  // ── Dashboard ────────────────────────────────────────────
  dash_total_value:      'Total Value',
  dash_holdings_value:   'Holdings Value',
  dash_today_pl:         "Today's P&L",
  dash_total_pl:         'Total P&L',
  dash_unrealized:       'Unrealized',
  dash_realized:         'Realized',
  dash_holdings_count:   'Positions',
  dash_top_gainer:       'Top Gainer',
  dash_top_loser:        'Top Loser',
  dash_sector_breakdown: 'Sector Breakdown',
  dash_benchmark:        'vs Benchmark',
  dash_history:          'Portfolio History',
  dash_position_alerts:  'Position Alerts',
  dash_no_holdings:      'No holdings yet. Import a CSV to get started.',

  // ── Holdings ─────────────────────────────────────────────
  holdings_title:        'Holdings',
  holdings_import:       'Import CSV',
  holdings_importing:    'Importing…',
  holdings_last_import:  'Last import',
  holdings_drop_csv:     'Drop CSV here or click to browse',
  holdings_import_ok:    'Import successful — {n} positions loaded',
  holdings_import_fail:  'Import failed: {msg}',
  holdings_symbol:       'Symbol',
  holdings_name:         'Name',
  holdings_qty:          'Qty',
  holdings_avg_cost:     'Avg Cost',
  holdings_price:        'Price',
  holdings_value:        'Value',
  holdings_unreal_pl:    'Unrealized P&L',
  holdings_real_pl:      'Realized P&L',
  holdings_today_pl:     "Today's P&L",
  holdings_weight:       'Weight',
  holdings_currency:     'Currency',
  holdings_sector:       'Sector',
  holdings_target:       'Target',
  holdings_stop:         'Stop Loss',
  holdings_notes:        'Notes',
  holdings_no_data:      'No holdings. Import a CSV to begin.',
  holdings_filter_all:   'All',
  holdings_filter_usd:   'USD',
  holdings_filter_myr:   'MYR',

  // ── Position alerts ───────────────────────────────────────
  alert_position_over:   '{symbol} is {pct}% of portfolio (limit: {limit}%)',

  // ── Sectors ──────────────────────────────────────────────
  sector_technology:     'Technology',
  sector_healthcare:     'Healthcare',
  sector_financials:     'Financials',
  sector_energy:         'Energy',
  sector_materials:      'Materials',
  sector_industrials:    'Industrials',
  sector_consumer_disc:  'Consumer Disc.',
  sector_consumer_stap:  'Consumer Staples',
  sector_utilities:      'Utilities',
  sector_real_estate:    'Real Estate',
  sector_comm_services:  'Comm. Services',
  sector_etf:            'ETF',
  sector_crypto:         'Crypto',
  sector_other:          'Other',

  // ── Quotes ───────────────────────────────────────────────
  quotes_refresh:        'Refresh Quotes',
  quotes_refreshing:     'Refreshing…',
  quotes_last_updated:   'Updated {time}',
  quotes_auto_30m:       'Auto · 30 min',
  quotes_manual:         'Manual',
  quotes_failed:         'Quote refresh failed',

  // ── Currency ─────────────────────────────────────────────
  currency_usd:          'USD',
  currency_myr:          'MYR',
  fx_rate:               'USD/MYR: {rate}',

  // ── Settings ─────────────────────────────────────────────
  settings_title:        'Settings',
  settings_account:      'Account',
  settings_display_name: 'Display Name',
  settings_language:     'Language',
  settings_theme:        'Theme',
  settings_theme_dark:   'Dark',
  settings_theme_light:  'Light',
  settings_pin:          'Change PIN',
  settings_ai_keys:      'AI API Keys',
  settings_gemini_key:   'Gemini API Key',
  settings_openai_key:   'OpenAI API Key',
  settings_key_guide:    'How to get a key',
  settings_max_position: 'Max Position Size (%)',
  settings_save:         'Save',
  settings_saved:        'Saved',
  settings_danger:       'Danger Zone',
  settings_reset:        'Factory Reset',

  // ── Currency & FX ────────────────────────────────────────
  settings_currency_fx:  'Currency & FX',
  settings_primary_cur:  'Primary currency',
  settings_primary_cur_d:'Which currency is shown as the hero value',
  settings_fx_mode:      'FX rate source',
  settings_fx_mode_manual:'Manual',
  settings_fx_mode_live: 'Live',
  settings_fx_manual:    'Manual rate (USD / MYR)',
  settings_fx_manual_d:  'Used as the reference rate. Update when your bank rate changes.',
  settings_fx_live_d:    'Auto-fetches from Yahoo Finance every 5 minutes.',
  settings_fx_last:      'Last fetched',
  settings_fx_never:     'Awaiting first fetch',

  // ── Common ───────────────────────────────────────────────
  btn_save:              'Save',
  btn_cancel:            'Cancel',
  btn_delete:            'Delete',
  btn_edit:              'Edit',
  btn_add:               'Add',
  btn_close:             'Close',
  btn_confirm:           'Confirm',
  loading:               'Loading…',
  error_generic:         'Something went wrong',
  empty_state:           'Nothing here yet',
}

const zh: Dict = {
  // ── App ─────────────────────────────────────────────────
  app_name:              'TradeOS',

  // ── Auth ────────────────────────────────────────────────
  auth_welcome:          '欢迎使用 TradeOS',
  auth_email:            '邮箱',
  auth_pin:              '输入 PIN',
  auth_create_pin:       '设置 PIN',
  auth_confirm_pin:      '确认 PIN',
  auth_pin_mismatch:     'PIN 不一致',
  auth_pin_wrong:        'PIN 错误',
  auth_sign_in:          '登录',
  auth_signing_in:       '登录中…',
  auth_invite_code:      '邀请码',
  auth_invite_invalid:   '邀请码无效或已过期',
  auth_register:         '创建账号',
  auth_have_account:     '已有账号？',
  auth_need_account:     '没有账号？',
  auth_your_name:        '你的名字',
  auth_lock:             '锁定',
  auth_locked:           '已锁定',
  auth_unlock:           '解锁',

  // ── Nav ─────────────────────────────────────────────────
  nav_dashboard:         '面板',
  nav_holdings:          '持仓',
  nav_watchlist:         '观察列表',
  nav_journal:           '交易日记',
  nav_planner:           '交易计划',
  nav_ai:                'AI 分析',
  nav_settings:          '设置',

  // ── Greetings ────────────────────────────────────────────
  greeting_morning:      '早上好',
  greeting_afternoon:    '下午好',
  greeting_evening:      '晚上好',

  // ── Market state ─────────────────────────────────────────
  market_open:           '开市',
  market_closed:         '收市',
  market_pre:            '盘前',
  market_pre_market:     '盘前',
  market_pre_open:       '集合竞价',
  market_morning:        '早盘',
  market_lunch:          '午休',
  market_afternoon:      '午盘',
  market_after_hours:    '盘后',
  market_overnight:      '夜间',
  market_post:           '盘后',
  market_holiday:        '节假日',
  market_closed_today:   '今天休市',

  // ── Strategy / Health / Action ───────────────────────────
  tax_CORE:              '核心',
  tax_TACTICAL:          '战术',
  tax_SPECULATIVE:       '投机',
  tax_HEALTHY:           '健康',
  tax_WEAK:              '弱势',
  tax_DEAD:              '重伤',
  tax_HOLD:              '持有',
  tax_ADD:               '加仓',
  tax_REDUCE:            '减仓',
  tax_EXIT:              '清仓',

  // ── Dashboard intelligence ───────────────────────────────
  dash_sector_alloc:     '板块分布',
  dash_movers:           '涨跌前列',
  dash_pulse:            '市场脉搏',
  dash_intel:            '组合信号',
  dash_concentration:    '{symbol} 占组合 {pct}',
  dash_concentration_d:  '超过 25% 集中度 — 建议减仓',
  dash_dead_pos:         '{symbol} 下跌 {pct}',
  dash_dead_pos_d:       '严重亏损 — 复审或清仓',
  dash_sector_heavy:     '{sector} 板块占组合 {pct}',
  dash_sector_heavy_d:   '单一板块集中度过高',
  col_strategy:          '策略',
  col_action:            '动作',

  // ── Dashboard ────────────────────────────────────────────
  dash_total_value:      '总市值',
  dash_holdings_value:   '持仓市值',
  dash_today_pl:         '今日盈亏',
  dash_total_pl:         '总盈亏',
  dash_unrealized:       '未实现',
  dash_realized:         '已实现',
  dash_holdings_count:   '持仓数',
  dash_top_gainer:       '最大涨幅',
  dash_top_loser:        '最大跌幅',
  dash_sector_breakdown: '板块分布',
  dash_benchmark:        '基准对比',
  dash_history:          '组合历史',
  dash_position_alerts:  '仓位预警',
  dash_no_holdings:      '暂无持仓，请导入 CSV 开始使用。',

  // ── Holdings ─────────────────────────────────────────────
  holdings_title:        '持仓',
  holdings_import:       '导入 CSV',
  holdings_importing:    '导入中…',
  holdings_last_import:  '上次导入',
  holdings_drop_csv:     '拖拽 CSV 到此处或点击选择',
  holdings_import_ok:    '导入成功，共 {n} 个持仓',
  holdings_import_fail:  '导入失败：{msg}',
  holdings_symbol:       '代码',
  holdings_name:         '名称',
  holdings_qty:          '数量',
  holdings_avg_cost:     '成本价',
  holdings_price:        '现价',
  holdings_value:        '市值',
  holdings_unreal_pl:    '未实现盈亏',
  holdings_real_pl:      '已实现盈亏',
  holdings_today_pl:     '今日盈亏',
  holdings_weight:       '占比',
  holdings_currency:     '币种',
  holdings_sector:       '板块',
  holdings_target:       '目标价',
  holdings_stop:         '止损价',
  holdings_notes:        '备注',
  holdings_no_data:      '暂无持仓，请导入 CSV。',
  holdings_filter_all:   '全部',
  holdings_filter_usd:   '美元',
  holdings_filter_myr:   '马币',

  // ── Position alerts ───────────────────────────────────────
  alert_position_over:   '{symbol} 占比 {pct}%（上限 {limit}%）',

  // ── Sectors ──────────────────────────────────────────────
  sector_technology:     '科技',
  sector_healthcare:     '医疗',
  sector_financials:     '金融',
  sector_energy:         '能源',
  sector_materials:      '原材料',
  sector_industrials:    '工业',
  sector_consumer_disc:  '可选消费',
  sector_consumer_stap:  '必需消费',
  sector_utilities:      '公用事业',
  sector_real_estate:    '房地产',
  sector_comm_services:  '通信服务',
  sector_etf:            'ETF',
  sector_crypto:         '加密货币',
  sector_other:          '其他',

  // ── Quotes ───────────────────────────────────────────────
  quotes_refresh:        '刷新行情',
  quotes_refreshing:     '刷新中…',
  quotes_last_updated:   '{time} 更新',
  quotes_auto_30m:       '自动 · 30分钟',
  quotes_manual:         '手动',
  quotes_failed:         '行情刷新失败',

  // ── Currency ─────────────────────────────────────────────
  currency_usd:          '美元',
  currency_myr:          '马币',
  fx_rate:               '美元/马币：{rate}',

  // ── Settings ─────────────────────────────────────────────
  settings_title:        '设置',
  settings_account:      '账号',
  settings_display_name: '显示名称',
  settings_language:     '语言',
  settings_theme:        '主题',
  settings_theme_dark:   '深色',
  settings_theme_light:  '浅色',
  settings_pin:          '修改 PIN',
  settings_ai_keys:      'AI API 密钥',
  settings_gemini_key:   'Gemini API 密钥',
  settings_openai_key:   'OpenAI API 密钥',
  settings_key_guide:    '如何获取密钥',
  settings_max_position: '仓位上限（%）',
  settings_save:         '保存',
  settings_saved:        '已保存',
  settings_danger:       '危险操作',
  settings_reset:        '恢复出厂设置',

  // ── Currency & FX ────────────────────────────────────────
  settings_currency_fx:  '币种与汇率',
  settings_primary_cur:  '主显示币种',
  settings_primary_cur_d:'哪个币种显示为主数值',
  settings_fx_mode:      '汇率来源',
  settings_fx_mode_manual:'手动',
  settings_fx_mode_live: '实时',
  settings_fx_manual:    '手动汇率（USD / MYR）',
  settings_fx_manual_d:  '作为参考汇率使用。银行汇率变了再来调整。',
  settings_fx_live_d:    '每 5 分钟从 Yahoo Finance 自动拉取。',
  settings_fx_last:      '最近刷新',
  settings_fx_never:     '等待首次拉取',

  // ── Common ───────────────────────────────────────────────
  btn_save:              '保存',
  btn_cancel:            '取消',
  btn_delete:            '删除',
  btn_edit:              '编辑',
  btn_add:               '添加',
  btn_close:             '关闭',
  btn_confirm:           '确认',
  loading:               '加载中…',
  error_generic:         '出了点问题',
  empty_state:           '暂无内容',
}

export const dictionaries: Record<Lang, Dict> = { en, zh }

/**
 * Translate a key with optional variable interpolation.
 * e.g. t('holdings_import_ok', { n: 13 }) → "Import successful — 13 positions loaded"
 */
export function translate(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dict = dictionaries[lang]
  let str = dict[key] ?? dictionaries['en'][key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return str
}
