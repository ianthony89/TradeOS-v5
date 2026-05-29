'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

interface ImportCsvButtonProps {
  /** Called after a successful import with the number of rows imported. */
  onImported?: (imported: number) => void
  /** Called with a human-readable message when the import fails. */
  onError?:    (message: string) => void
  className?:  string
}

/**
 * Reusable CSV import trigger.
 * Encapsulates the file picker + POST to the existing /api/import endpoint.
 * No import logic is duplicated — the parse/save lives server-side in
 * /api/import. Pages just react to onImported / onError.
 */
export function ImportCsvButton({ onImported, onError, className = '' }: ImportCsvButtonProps) {
  const t = useT()
  const ref = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  async function handleFile(file: File) {
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res  = await fetch('/api/import', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        const detail = json.details ?? json.detail
        throw new Error(detail ? `${json.error}: ${detail}` : (json.error ?? 'Import failed'))
      }
      onImported?.(json.imported ?? 0)
    } catch (e) {
      onError?.((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''   // allow re-selecting the same file
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={importing}
        className={`btn btn-primary btn-sm ${className}`}
      >
        <Upload size={13} />
        {importing ? t('holdings_importing') : t('holdings_import')}
      </button>
    </>
  )
}
