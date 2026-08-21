import { useCallback, useEffect, useState } from 'react'
import { MailWarning, RefreshCw, RotateCcw } from 'lucide-react'
import { getAdminDeliveryIssues, retryDeliveryIssue } from '../api/platformApi'
import { useAuth } from '../context/AuthContext'

function formatTime(iso) {
  if (!iso) return '-'
  try { return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) } catch { return iso }
}

// Paid purchases whose delivery email failed, got stuck, or outlived the
// cron cadence. These are the rows that previously only appeared in raw
// Worker logs; the Retry action resets the row and re-sends immediately.
export default function AdminDeliveryIssues() {
  const { session } = useAuth()
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retryingId, setRetryingId] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    if (!session?.access_token) return
    setLoading(true)
    setError('')
    try {
      const data = await getAdminDeliveryIssues({ token: session.access_token })
      setIssues(data?.issues || [])
    } catch (loadError) {
      setError(loadError.message || 'Delivery issues could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => { load() }, [load])

  const retry = useCallback(async (purchaseId) => {
    if (!session?.access_token || retryingId) return
    setRetryingId(purchaseId)
    setError('')
    setNotice('')
    try {
      await retryDeliveryIssue(purchaseId, { token: session.access_token })
      setNotice('Redelivery queued and sending now. The row drops off this list once it succeeds.')
      // The send completes server-side within moments; give the list a
      // second before refreshing so the new status has been written.
      window.setTimeout(load, 1500)
    } catch (retryError) {
      setError(retryError.message || 'The redelivery could not be started.')
    } finally {
      setRetryingId('')
    }
  }, [session?.access_token, retryingId, load])

  const permanentCount = issues.filter((issue) => issue.permanent).length

  return (
    <section className="audit-log ops-panel" aria-label="Delivery issues">
      <div className="audit-log__head">
        <div>
          <MailWarning size={18} />
          <h3>Delivery issues</h3>
        </div>
        <button className="button text" type="button" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      {error && <p className="audit-log__error" role="alert">{error}</p>}
      {notice && <p className="ops-panel__notice" role="status">{notice}</p>}
      {issues.length === 0 && !loading ? (
        <p className="audit-log__empty">No delivery problems. Every paid order has a working delivery email.</p>
      ) : (
        <>
          {permanentCount > 0 && (
            <p className="ops-panel__warning" role="alert">
              {permanentCount} {permanentCount === 1 ? 'order has' : 'orders have'} exhausted all 5 automatic attempts and will not retry on their own.
            </p>
          )}
          <table className="audit-log__table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Product</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Last error</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id}>
                  <td>{issue.customerEmail || '-'}</td>
                  <td><code>{issue.productKey || '-'}</code></td>
                  <td>
                    <span className={`status-pill status-${issue.status}`}>{issue.status}</span>
                    {issue.permanent && <span className="status-pill status-failed">permanent</span>}
                  </td>
                  <td>{issue.attempts}</td>
                  <td><code className="ops-cell-truncate">{issue.lastError || '-'}</code></td>
                  <td>{formatTime(issue.updatedAt)}</td>
                  <td>
                    <button className="button text" type="button" disabled={retryingId === issue.id} onClick={() => retry(issue.id)}>
                      <RotateCcw size={14} /> {retryingId === issue.id ? 'Sending...' : 'Retry'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
