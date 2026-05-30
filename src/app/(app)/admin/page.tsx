'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShieldAlert, Plus, Copy, Check, UserCheck } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { fmt }  from '@/lib/utils/format'
import { Panel, PanelHead, PanelBody } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'

interface InviteCode {
  id:         string
  code:       string
  used_at:    string | null
  created_at: string
}
interface Member {
  id:        string
  name:      string | null
  email:     string
  createdAt: string
}

export default function AdminPage() {
  const { t, lang } = useI18n()

  const [loading,   setLoading]   = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [codes,     setCodes]     = useState<InviteCode[]>([])
  const [pending,   setPending]   = useState<Member[]>([])
  const [approved,  setApproved]  = useState<Member[]>([])

  const [generating, setGenerating] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [copiedId,    setCopiedId]    = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/data', { cache: 'no-store' })
      if (res.status === 403) { setForbidden(true); return }
      const json = await res.json()
      setCodes(json.codes ?? [])
      setPending(json.pending ?? [])
      setApproved(json.approved ?? [])
    } catch { /* leave empty */ }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData().finally(() => setLoading(false))
  }, [loadData])

  async function generate() {
    if (generating) return
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/invite', { method: 'POST' })
      if (res.ok) {
        // Reload from the DB so the displayed code is authoritative.
        await loadData()
      }
    } catch { /* ignore */ }
    finally { setGenerating(false) }
  }

  async function approve(userId: string) {
    if (approvingId) return
    setApprovingId(userId)
    try {
      const res = await fetch('/api/admin/approve', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ userId }),
      })
      if (res.ok) {
        // Reload so the user moves from Pending into Members authoritatively.
        await loadData()
      }
    } catch { /* ignore */ }
    finally { setApprovingId(null) }
  }

  async function copy(code: string, id: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch { /* clipboard blocked */ }
  }

  /* ── Forbidden / loading ────────────────────────────────── */
  if (forbidden) {
    return (
      <div>
        <div className="section-header">
          <h1 className="section-title">{t('nav_admin')}</h1>
        </div>
        <Panel>
          <PanelBody>
            <EmptyState
              icon={<ShieldAlert size={20} />}
              title={t('admin_forbidden_title')}
              sub={t('admin_forbidden_sub')}
            />
          </PanelBody>
        </Panel>
      </div>
    )
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('nav_admin')}</h1>
          <p className="section-sub">
            {t('admin_sub')}
            {!loading && ` · ${t('admin_approved_count', { n: approved.length })}`}
          </p>
        </div>
      </div>

      {/* Invite codes */}
      <Panel>
        <PanelHead
          title={t('admin_codes_title')}
          actions={
            <button onClick={generate} disabled={generating} className="btn btn-primary btn-sm">
              {generating ? <span className="auth-spinner" /> : <><Plus size={13} />{t('admin_generate')}</>}
            </button>
          }
        />
        <PanelBody flush>
          {loading ? (
            <EmptyState title={t('loading')} />
          ) : !codes.length ? (
            <EmptyState title={t('admin_no_codes')} />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <tbody>
                  {codes.map(c => (
                    <tr key={c.id}>
                      <td className="text-mono td--strong" style={{ letterSpacing: '0.06em' }}>
                        {c.code}
                      </td>
                      <td>
                        <span className={`badge ${c.used_at ? 'badge--neutral' : 'badge--positive'}`}>
                          {c.used_at ? t('admin_code_used') : t('admin_code_unused')}
                        </span>
                      </td>
                      <td className="text-tertiary" style={{ fontSize: 12 }}>
                        {fmt.relativeTime(c.created_at, lang)}
                      </td>
                      <td className="num">
                        {!c.used_at && (
                          <button
                            onClick={() => copy(c.code, c.id)}
                            className="btn btn-ghost btn-xs"
                            title={t('admin_copy')}
                          >
                            {copiedId === c.id
                              ? <><Check size={12} />{t('admin_copied')}</>
                              : <><Copy size={12} />{t('admin_copy')}</>}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </Panel>

      {/* Pending approvals */}
      <div style={{ marginTop: 18 }}>
        <Panel>
          <PanelHead
            title={t('admin_pending_title')}
            meta={loading ? '' : String(pending.length)}
          />
          <PanelBody flush>
            {loading ? (
              <EmptyState title={t('loading')} />
            ) : !pending.length ? (
              <EmptyState icon={<UserCheck size={20} />} title={t('admin_no_pending')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <tbody>
                    {pending.map(u => (
                      <tr key={u.id}>
                        <td className="td--strong">{u.name || '—'}</td>
                        <td className="text-mono text-tertiary" style={{ fontSize: 12 }}>{u.email}</td>
                        <td className="text-tertiary" style={{ fontSize: 12 }}>
                          {fmt.relativeTime(u.createdAt, lang)}
                        </td>
                        <td className="num">
                          <button
                            onClick={() => approve(u.id)}
                            disabled={approvingId === u.id}
                            className="btn btn-primary btn-xs"
                          >
                            {approvingId === u.id
                              ? t('admin_approving')
                              : <><UserCheck size={12} />{t('admin_approve')}</>}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>

      {/* Members (approved users) */}
      <div style={{ marginTop: 18 }}>
        <Panel>
          <PanelHead
            title={t('admin_members_title')}
            meta={loading ? '' : String(approved.length)}
          />
          <PanelBody flush>
            {loading ? (
              <EmptyState title={t('loading')} />
            ) : !approved.length ? (
              <EmptyState title={t('admin_no_members')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <tbody>
                    {approved.map(u => (
                      <tr key={u.id}>
                        <td className="td--strong">{u.name || '—'}</td>
                        <td className="text-mono text-tertiary" style={{ fontSize: 12 }}>{u.email}</td>
                        <td className="text-tertiary" style={{ fontSize: 12 }}>
                          {fmt.relativeTime(u.createdAt, lang)}
                        </td>
                        <td className="num">
                          <span className="badge badge--positive">{t('admin_member_approved')}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  )
}
