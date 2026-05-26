'use client'
// ============================================================
//  TradeOS v5 — i18n React Context
// ============================================================

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { type Lang, translate } from './dictionary'

interface I18nContextValue {
  lang:    Lang
  setLang: (l: Lang) => void
  t:       (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue>({
  lang:    'en',
  setLang: () => {},
  t:       (key) => key,
})

export function I18nProvider({
  children,
  initialLang = 'en',
}: {
  children:     ReactNode
  initialLang?: Lang
}) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((l: Lang) => setLangState(l), [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      translate(lang, key, vars),
    [lang],
  )

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

export function useT() {
  return useContext(I18nContext).t
}
