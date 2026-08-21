import { useCallback, useEffect, useState } from 'react'
import { Bug, RefreshCw } from 'lucide-react'
import { getAdminClientErrors } from '../api/platformApi'
import { useAuth } from '../context/AuthContext'

function formatTime(iso) {
  if (!iso) return '-'
  try { return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) } catch { return iso }
}

const KIND_LABELS = {
  render: 'render crash',
  error: 'script error',
  unhandledrejection: 'promise rejection',
}

// Client-side errors reported by storefront browsers (Layer 12). Retained
// server-side for 30 days and PII-redacted before storage, so this table is
// safe to read and safe to keep.
export default function AdminClientErrors() {
  const { session } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!session?.access_token) return
    setLoading(true)
    setError('')
    try {
      setEntries(await getAdminClientErrors({ limit: 100 }, { token: session.access_token }))
    } catch (loadError) {
      setError(loadError.message || 'Client errors could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => { load() }, [load])

  return (
    <section className="audit-log ops-panel" aria-label="Client-side errors">
      <div className="audit-log__head">
        <div>
          <Bug size={18} />
          <h3>Client-side errors</h3>
        </div>
        <button className="button text" type="button" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      {error && <p className="audit-log__error" role="alert">{error}</p>}
      {entries.length === 0 && !loading ? (
        <p className="audit-log__empty">No client errors reported. Storefront crashes and script failures will appear here.</p>
      ) : (
        <table className="audit-log__table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Message</th>
              <th>Page</th>
              <th>Browser</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{formatTime(entry.createdAt)}</td>
                <td>{KIND_LABELS[entry.kind] || entry.kind}</td>
                <td><code className="ops-cell-truncate">{entry.message}</code></td>
                <td><code>{entry.url || '-'}</code></td>
                <td><span className="ops-cell-truncate">{entry.userAgent || '-'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
