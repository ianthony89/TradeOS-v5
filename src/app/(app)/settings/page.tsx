'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon, Languages } from 'lucide-react'
import { createClient }     from '@/lib/supabase/client'
import { Panel, PanelHead, PanelBody } from '@/components/ui/panel'
import { useI18n, useT }    from '@/lib/i18n/context'
import { useMarketStore }   from '@/stores/market'
import { fmt }              from '@/lib/utils/format'
import type { Lang }        from '@/lib/i18n/dictionary'

type Theme = 'dark' | 'light'

export default function SettingsPage() {
  const supabase = createClient()
  const t        = useT()
  const { lang, setLang } = useI18n()

  const [theme,    setTheme]    = useState<Theme>('dark')
  const [userName, setUserName] = useState('')
  const [email,    setEmail]    = useState('')
  const [saving,   setSaving]   = useState(false)

  /* Market store — currency + FX preferences */
  const primaryCurrency    = useMarketStore(s => s.primaryCurrency)
  const setPrimaryCurrency = useMarketStore(s => s.setPrimaryCurrency)
  const fxMode             = useMarketStore(s => s.fxMode)
  const setFxMode          = useMarketStore(s => s.setFxMode)
  const fxManualRate       = useMarketStore(s => s.fxManualRate)
  const setFxManualRate    = useMarketStore(s => s.setFxManualRate)
  const fxLiveRate         = useMarketStore(s => s.fxLiveRate)
  const fxUpdatedAt        = useMarketStore(s => s.fxUpdatedAt)

  const [manualRateInput, setManualRateInput] = useState(fxManualRate.toFixed(4))

  /* Change PIN — verify current first, then set new */
  const [pinStep,    setPinStep]    = useState<'verify' | 'set'>('verify')
  const [currentPin, setCurrentPin] = useState('')
  const [newPin,     setNewPin]     = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinSaving,  setPinSaving]  = useState(false)
  const [pinMsg,     setPinMsg]     = useState('')
  const [pinErr,     setPinErr]     = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email ?? '')
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, theme, lang')
        .eq('id', user.id)
        .single()
      if (profile) {
        if (profile.name)  setUserName(profile.name)
        if (profile.theme) setTheme(profile.theme as Theme)
        if (profile.lang)  setLang(profile.lang as Lang)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Keep local manual-rate input in sync with store.
     setState in effect is deliberate: the store is the external source
     of truth, the local input mirrors it for editing UX. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setManualRateInput(fxManualRate.toFixed(4))
  }, [fxManualRate])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function persistTheme(next: Theme) {
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').update({ theme: next }).eq('id', user.id)
  }

  async function persistLang(next: Lang) {
    setLang(next)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').update({ lang: next }).eq('id', user.id)
  }

  async function persistName() {
    if (!userName.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').update({ name: userName.trim() }).eq('id', user.id)
    setSaving(false)
  }

  async function verifyCurrentPin(e: React.FormEvent) {
    e.preventDefault()
    setPinMsg(''); setPinErr(false)
    if (!currentPin) return
    setPinSaving(true)
    // Re-authenticate to confirm the current PIN is correct.
    const { error } = await supabase.auth.signInWithPassword({ email, password: currentPin })
    setPinSaving(false)
    if (error) { setPinErr(true); setPinMsg(t('auth_pin_wrong')); return }
    setPinStep('set')
  }

  async function changePin(e: React.FormEvent) {
    e.preventDefault()
    setPinMsg(''); setPinErr(false)
    if (newPin.length < 4) { setPinErr(true); setPinMsg(t('settings_pin_short')); return }
    if (newPin !== confirmPin) { setPinErr(true); setPinMsg(t('auth_pin_mismatch')); return }
    setPinSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPin })
    setPinSaving(false)
    if (error) { setPinErr(true); setPinMsg(error.message); return }
    setPinMsg(t('settings_pin_updated'))
    setPinStep('verify'); setCurrentPin(''); setNewPin(''); setConfirmPin('')
  }

  function commitManualRate() {
    const v = parseFloat(manualRateInput)
    if (Number.isFinite(v) && v > 0 && v < 100) {
      setFxManualRate(v)
    } else {
      // Snap back to last valid value
      setManualRateInput(fxManualRate.toFixed(4))
    }
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('nav_settings')}</h1>
          <p className="section-sub">{t('settings_sub')}</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Account */}
        <Panel>
          <PanelHead title={t('settings_account')} />
          <PanelBody>
            <div style={{ display: 'grid', gap: 14 }}>
              <SettingsRow label={t('settings_email')}>
                <span className="text-mono text-secondary" style={{ fontSize: 13 }}>
                  {email || '—'}
                </span>
              </SettingsRow>
              <SettingsRow label={t('settings_display_name')}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                  <input
                    value={userName}
                    onChange={e => setUserName(e.target.value)}
                    onBlur={persistName}
                    className="input"
                    placeholder={t('settings_name_ph')}
                    style={{ maxWidth: 260 }}
                  />
                  {saving && (
                    <span className="text-tertiary" style={{ fontSize: 11.5 }}>
                      {t('settings_saved')}…
                    </span>
                  )}
                </div>
              </SettingsRow>
            </div>
          </PanelBody>
        </Panel>

        {/* Security — change PIN (verify current → set new) */}
        <Panel>
          <PanelHead title={t('settings_security')} />
          <PanelBody>
            {pinStep === 'verify' ? (
              <form onSubmit={verifyCurrentPin} style={{ display: 'grid', gap: 14 }}>
                <SettingsRow label={t('settings_current_pin')}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="password" inputMode="numeric" autoComplete="current-password"
                      value={currentPin}
                      onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                      className="input text-mono text-tabular"
                      style={{ maxWidth: 200, letterSpacing: '0.3em' }}
                      maxLength={8}
                    />
                    <button type="submit" disabled={pinSaving} className="btn btn-primary btn-sm">
                      {pinSaving ? <span className="auth-spinner" /> : t('settings_continue')}
                    </button>
                    {pinMsg && (
                      <span style={{ fontSize: 11.5, color: pinErr ? 'var(--negative)' : 'var(--positive)' }}>{pinMsg}</span>
                    )}
                  </div>
                </SettingsRow>
              </form>
            ) : (
              <form onSubmit={changePin} style={{ display: 'grid', gap: 14 }}>
                <SettingsRow label={t('settings_new_pin')}>
                  <input
                    type="password" inputMode="numeric" autoComplete="new-password"
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="input text-mono text-tabular"
                    style={{ maxWidth: 200, letterSpacing: '0.3em' }}
                    maxLength={8}
                  />
                </SettingsRow>
                <SettingsRow label={t('settings_confirm_pin')}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="password" inputMode="numeric" autoComplete="new-password"
                      value={confirmPin}
                      onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      className="input text-mono text-tabular"
                      style={{ maxWidth: 200, letterSpacing: '0.3em' }}
                      maxLength={8}
                    />
                    <button type="submit" disabled={pinSaving} className="btn btn-primary btn-sm">
                      {pinSaving ? <span className="auth-spinner" /> : t('settings_update_pin')}
                    </button>
                    {pinMsg && (
                      <span style={{ fontSize: 11.5, color: pinErr ? 'var(--negative)' : 'var(--positive)' }}>{pinMsg}</span>
                    )}
                  </div>
                </SettingsRow>
              </form>
            )}
          </PanelBody>
        </Panel>

        {/* Appearance */}
        <Panel>
          <PanelHead title={t('settings_appearance')} />
          <PanelBody>
            <div style={{ display: 'grid', gap: 14 }}>
              <SettingsRow label={t('settings_theme')}>
                <div className="chip-group">
                  <button
                    type="button"
                    onClick={() => persistTheme('dark')}
                    className={`chip${theme === 'dark' ? ' chip--active' : ''}`}
                  >
                    <Moon size={11} style={{ marginRight: 5, verticalAlign: '-1px' }} />
                    {t('settings_theme_dark')}
                  </button>
                  <button
                    type="button"
                    onClick={() => persistTheme('light')}
                    className={`chip${theme === 'light' ? ' chip--active' : ''}`}
                  >
                    <Sun size={11} style={{ marginRight: 5, verticalAlign: '-1px' }} />
                    {t('settings_theme_light')}
                  </button>
                </div>
              </SettingsRow>
              <SettingsRow label={t('settings_language')}>
                <div className="chip-group">
                  <button
                    type="button"
                    onClick={() => persistLang('en')}
                    className={`chip${lang === 'en' ? ' chip--active' : ''}`}
                  >
                    <Languages size={11} style={{ marginRight: 5, verticalAlign: '-1px' }} />
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => persistLang('zh')}
                    className={`chip${lang === 'zh' ? ' chip--active' : ''}`}
                  >
                    中文
                  </button>
                </div>
              </SettingsRow>
            </div>
          </PanelBody>
        </Panel>

        {/* Currency & FX */}
        <Panel>
          <PanelHead title={t('settings_currency_fx')} />
          <PanelBody>
            <div style={{ display: 'grid', gap: 14 }}>

              <SettingsRow
                label={t('settings_primary_cur')}
                hint={t('settings_primary_cur_d')}
              >
                <div className="chip-group">
                  <button
                    type="button"
                    onClick={() => setPrimaryCurrency('USD')}
                    className={`chip${primaryCurrency === 'USD' ? ' chip--active' : ''}`}
                  >
                    USD
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrimaryCurrency('MYR')}
                    className={`chip${primaryCurrency === 'MYR' ? ' chip--active' : ''}`}
                  >
                    MYR
                  </button>
                </div>
              </SettingsRow>

              <SettingsRow
                label={t('settings_fx_mode')}
                hint={fxMode === 'live' ? t('settings_fx_live_d') : t('settings_fx_manual_d')}
              >
                <div className="chip-group">
                  <button
                    type="button"
                    onClick={() => setFxMode('manual')}
                    className={`chip${fxMode === 'manual' ? ' chip--active' : ''}`}
                  >
                    {t('settings_fx_mode_manual')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFxMode('live')}
                    className={`chip${fxMode === 'live' ? ' chip--active' : ''}`}
                  >
                    {t('settings_fx_mode_live')}
                  </button>
                </div>
              </SettingsRow>

              <SettingsRow label={t('settings_fx_manual')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.0001"
                    min="0.1"
                    max="20"
                    value={manualRateInput}
                    onChange={e => setManualRateInput(e.target.value)}
                    onBlur={commitManualRate}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    className="input text-mono text-tabular"
                    style={{ width: 140, textAlign: 'right' }}
                  />
                  <span className="text-tertiary" style={{ fontSize: 11.5 }}>
                    {fxMode === 'live' ? t('settings_fx_fallback') : t('settings_fx_in_use')}
                  </span>
                </div>
              </SettingsRow>

              {fxMode === 'live' && (
                <SettingsRow label={t('settings_fx_last')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {fxUpdatedAt ? (
                      <>
                        <span className="text-mono text-tabular text-secondary" style={{ fontSize: 13 }}>
                          {fmt.fxRate(fxLiveRate)}
                        </span>
                        <span className="text-tertiary" style={{ fontSize: 11.5 }}>
                          · {fmt.relativeTime(fxUpdatedAt, lang)}
                        </span>
                      </>
                    ) : (
                      <span className="text-tertiary" style={{ fontSize: 12 }}>
                        {t('settings_fx_never')}…
                      </span>
                    )}
                  </div>
                </SettingsRow>
              )}

            </div>
          </PanelBody>
        </Panel>

      </div>
    </div>
  )
}

function SettingsRow({
  label, hint, children,
}: {
  label:    string
  hint?:    string
  children: React.ReactNode
}) {
  return (
    <div style={{
      display:    'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap:        16,
      flexWrap:   'wrap',
    }}>
      <div style={{ minWidth: 180, flex: '0 0 auto' }}>
        <div className="text-secondary" style={{ fontSize: 13, fontWeight: 500 }}>
          {label}
        </div>
        {hint && (
          <div className="text-tertiary" style={{ fontSize: 11.5, marginTop: 3, maxWidth: 320, lineHeight: 1.4 }}>
            {hint}
          </div>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}
