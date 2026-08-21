import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { enrollAdminTOTP, getAdminTOTPStatus, resetAdminTOTP, verifyAdminTOTP } from '../api/platformApi'
import { useAuth } from '../context/AuthContext'

// Renders the 2FA enrolment and code-entry UI for admin mutations. Owns
// the local state machine: idle -> enrolled (showing secret + recovery
// codes) -> verified -> idle. The component is reused for both first-
// time enrolment and re-enrolment after a reset.
export default function AdminTOTPSetup() {
  const { session } = useAuth()
  const [status, setStatus] = useState(null) // { enrolled, verified, enrolledAt, lastUsedAt }
  const [loading, setLoading] = useState(false)
  const [enrolment, setEnrolment] = useState(null) // { secret, otpauthUrl, recoveryCodes }
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const loadStatus = useCallback(async () => {
    if (!session?.access_token) return
    setLoading(true)
    setError('')
    try {
      setStatus(await getAdminTOTPStatus({ token: session.access_token, totp: localStorage.getItem(`runway.admin.totp.${session.user?.id}`) || '' }))
    } catch (loadError) {
      setError(loadError.message || '2FA status could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [session?.access_token, session?.user?.id])

  useEffect(() => { loadStatus() }, [loadStatus])

  const startEnrolment = async () => {
    setLoading(true)
    setError('')
    setInfo('')
    setEnrolment(null)
    try {
      const result = await enrollAdminTOTP({ token: session.access_token, totp: localStorage.getItem(`runway.admin.totp.${session.user?.id}`) || '' })
      setEnrolment(result)
    } catch (enrolError) {
      setError(enrolError.message || '2FA enrolment could not start.')
    } finally {
      setLoading(false)
    }
  }

  const confirmEnrolment = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await verifyAdminTOTP({ code: code.trim() }, { token: session.access_token, totp: code.trim() })
      setInfo('Two-factor authentication is now active for admin actions.')
      setEnrolment(null)
      setCode('')
      await loadStatus()
    } catch (verifyError) {
      setError(verifyError.message || 'The code is incorrect.')
    } finally {
      setLoading(false)
    }
  }

  const reset = async () => {
    if (!window.confirm('Reset two-factor authentication? You will need to re-enrol on the next admin action.')) return
    setLoading(true)
    setError('')
    try {
      await resetAdminTOTP({ token: session.access_token, totp: localStorage.getItem(`runway.admin.totp.${session.user?.id}`) || '' })
      setInfo('2FA reset. You can enrol again now.')
      setEnrolment(null)
      setCode('')
      await loadStatus()
    } catch (resetError) {
      setError(resetError.message || '2FA could not be reset.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="totp-setup" aria-label="Two-factor authentication">
      <div className="totp-setup__head">
        <ShieldCheck size={18} />
        <div>
          <h3>Two-factor authentication</h3>
          <p>Every admin change requires a 6-digit code from an authenticator app, plus a session issued within the last 30 minutes.</p>
        </div>
      </div>
      {status?.verified ? (
        <div className="totp-setup__verified">
          <p className="totp-setup__status ok"><b>Active.</b> Enrolled {status.enrolledAt ? new Date(status.enrolledAt).toLocaleString() : 'recently'}{status.lastUsedAt ? ` · last used ${new Date(status.lastUsedAt).toLocaleString()}` : ''}.</p>
          <button className="button text" type="button" onClick={reset} disabled={loading}>Reset 2FA</button>
        </div>
      ) : enrolment ? (
        <div className="totp-setup__enrol">
          <p>Scan this secret in Google Authenticator, 1Password, Authy, or any TOTP app:</p>
          <code className="totp-setup__secret">{enrolment.secret}</code>
          <p className="totp-setup__hint">Or paste this URL into an authenticator that accepts otpauth:// links.</p>
          <input className="totp-setup__url" readOnly value={enrolment.otpauthUrl} />
          <p className="totp-setup__hint"><b>Save these one-time recovery codes.</b> Each can replace the authenticator once. They are not shown again.</p>
          <ul className="totp-setup__recovery">
            {enrolment.recoveryCodes.map((c) => (<li key={c}>{c}</li>))}
          </ul>
          <label className="totp-setup__code">
            <span>Confirm with the current 6-digit code</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
            />
          </label>
          <div className="totp-setup__actions">
            <button className="button primary" type="button" onClick={confirmEnrolment} disabled={loading || code.length !== 6}>Confirm enrolment</button>
            <button className="button text" type="button" onClick={startEnrolment} disabled={loading}>Start over</button>
          </div>
        </div>
      ) : (
        <div className="totp-setup__idle">
          <p className="totp-setup__status warn"><b>Not enrolled.</b> Until you enrol, any stolen admin session token can make changes.</p>
          <button className="button primary" type="button" onClick={startEnrolment} disabled={loading}>Enrol now</button>
        </div>
      )}
      {error && <p className="totp-setup__error" role="alert">{error}</p>}
      {info && <p className="totp-setup__info" role="status">{info}</p>}
    </section>
  )
}
