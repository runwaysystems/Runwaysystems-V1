import { useEffect, useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'
import { getActiveAdminTotp, setActiveAdminTotp } from '../api/platformApi'

// Compact TOTP code entry. Owns the local "active code" that every
// subsequent admin request picks up via the platformApi wrapper. The
// banner above the form tells the user how long the code is valid for.
//
// On mount the component re-reads the active code from the platformApi
// wrapper, which consults sessionStorage. That way a page refresh keeps
// the "code active" banner up if the 5-minute TTL is still valid, and
// the next mutation does not require the user to retype the code.
export default function AdminTotpPrompt() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [active, setActive] = useState(false)

  useEffect(() => {
    setActive(Boolean(getActiveAdminTotp()))
  }, [])

  const submit = (event) => {
    event.preventDefault()
    const trimmed = code.trim()
    if (!/^\d{6}$/.test(trimmed)) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setActiveAdminTotp(trimmed)
    setCode('')
    setError('')
    setActive(true)
  }

  const clear = () => {
    setActiveAdminTotp('')
    setActive(false)
  }

  if (active) {
    return (
      <div className="admin-totp-banner admin-totp-banner--ok">
        <ShieldCheck size={15} />
        <span>Authenticator code active for the next 5 minutes. Survives page refresh; clears when this tab closes.</span>
        <button type="button" className="button text" onClick={clear}>
          <X size={12} /> Clear
        </button>
      </div>
    )
  }

  return (
    <form className="admin-totp-banner admin-totp-banner--form" onSubmit={submit}>
      <ShieldCheck size={15} />
      <label>
        <span className="admin-totp-banner__label">Authenticator code</span>
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
      <button type="submit" className="button primary" disabled={code.length !== 6}>Apply</button>
      {error && <span className="admin-totp-banner__error" role="alert">{error}</span>}
    </form>
  )
}
