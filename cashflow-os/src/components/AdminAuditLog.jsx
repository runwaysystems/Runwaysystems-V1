import { useCallback, useEffect, useState } from 'react'
import { ScrollText, RefreshCw } from 'lucide-react'
import { getAdminAuditLog } from '../api/platformApi'
import { useAuth } from '../context/AuthContext'

function formatTime(iso) {
  if (!iso) return '—'
  try { return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) } catch { return iso }
}

export default function AdminAuditLog() {
  const { session } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!session?.access_token) return
    setLoading(true)
    setError('')
    try {
      setEntries(await getAdminAuditLog({ limit: 200 }, { token: session.access_token }))
    } catch (loadError) {
      setError(loadError.message || 'Audit log could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => { load() }, [load])

  return (
    <section className="audit-log" aria-label="Admin audit log">
      <div className="audit-log__head">
        <div>
          <ScrollText size={18} />
          <h3>Audit log</h3>
        </div>
        <button className="button text" type="button" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {error && <p className="audit-log__error" role="alert">{error}</p>}
      {entries.length === 0 && !loading ? (
        <p className="audit-log__empty">No actions recorded yet. Every admin change will appear here.</p>
      ) : (
        <table className="audit-log__table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{formatTime(entry.createdAt)}</td>
                <td>{entry.subjectEmail || entry.subjectId || '—'}</td>
                <td><code>{entry.action}</code></td>
                <td>{entry.entityType ? `${entry.entityType}:${entry.entityId || '—'}` : '—'}</td>
                <td><code>{JSON.stringify(entry.details || {})}</code></td>
                <td>{entry.ip || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
