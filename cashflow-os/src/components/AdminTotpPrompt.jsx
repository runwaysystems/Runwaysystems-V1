import { useEffect, useState } from 'react'
import { KeyRound, ShieldCheck, X } from 'lucide-react'
import {
  createAdminTOTPChallenge,
  getActiveAdminChallenge,
  setActiveAdminChallenge,
  subscribeAdminChallenge,
} from '../api/platformApi'
import { useAuth } from '../context/AuthContext'

// Authenticator and recovery codes are verified by the Worker once. The
// browser persists only the resulting signed, session-bound five-minute
// challenge, never a raw reusable code.
export default function AdminTotpPrompt() {
  const { session } = useAuth()
  const [value, setValue] = useState('')
  const [mode, setMode] = useState('totp')
  const [error, setError] = useState('')
  const [active, setActive] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setActive(Boolean(getActiveAdminChallenge()))
    return subscribeAdminChallenge(setActive)
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    const trimmed = value.trim().toLowerCase()
    const valid = mode === 'totp' ? /^\d{6}$/.test(trimmed) : /^[a-f0-9]{4}-[a-f0-9]{4}$/.test(trimmed)
    if (!valid) {
      setError(mode === 'totp' ? 'Enter the current 6-digit authenticator code.' : 'Enter a recovery code in the format xxxx-xxxx.')
      return
    }
    setPending(true)
    setError('')
    try {
      const result = await createAdminTOTPChallenge(
        mode === 'totp' ? { code: trimmed } : { recoveryCode: trimmed },
        { token: session?.access_token },
      )
      setActiveAdminChallenge(result.challenge, result.expiresAt)
      setValue('')
      setActive(true)
    } catch (challengeError) {
      setError(challengeError.message || 'The security code could not be verified.')
    } finally {
      setPending(false)
    }
  }

  const clear = () => {
    setActiveAdminChallenge('', 0)
    setActive(false)
  }

  if (active) {
    return (
      <div className="admin-totp-banner admin-totp-banner--ok" role="status">
        <ShieldCheck size={15} />
        <span>Admin security verified for up to five minutes in this tab.</span>
        <button type="button" className="button text" onClick={clear}>
          <X size={12} /> Clear
        </button>
      </div>
    )
  }

  return (
    <form className="admin-totp-banner admin-totp-banner--form" onSubmit={submit}>
      {mode === 'totp' ? <ShieldCheck size={15} /> : <KeyRound size={15} />}
      <label>
        <span className="admin-totp-banner__label">{mode === 'totp' ? 'Authenticator code' : 'Recovery code'}</span>
        <input
          type="text"
          inputMode={mode === 'totp' ? 'numeric' : 'text'}
          autoComplete="one-time-code"
          maxLength={mode === 'totp' ? 6 : 9}
          value={value}
          onChange={(event) => setValue(mode === 'totp'
            ? event.target.value.replace(/\D/g, '').slice(0, 6)
            : event.target.value.toLowerCase().replace(/[^a-f0-9-]/g, '').slice(0, 9))}
          placeholder={mode === 'totp' ? '123456' : 'abcd-1234'}
        />
      </label>
      <button type="submit" className="button primary" disabled={pending || !value}>{pending ? 'Verifying...' : 'Verify'}</button>
      <button
        type="button"
        className="button text"
        onClick={() => { setMode((current) => current === 'totp' ? 'recovery' : 'totp'); setValue(''); setError('') }}
      >
        {mode === 'totp' ? 'Use recovery code' : 'Use authenticator'}
      </button>
      {error && <span className="admin-totp-banner__error" role="alert">{error}</span>}
    </form>
  )
}
