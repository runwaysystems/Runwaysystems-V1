import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Library, LogOut, ShieldCheck, UserRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSiteCopy } from '../lib/siteCopy'
import { RunwayMark } from './Brand'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.29-2.65l-3.57-2.77c-.99.66-2.25 1.05-3.72 1.05-2.87 0-5.3-1.94-6.17-4.54H2.14v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.83 14.09A6.6 6.6 0 0 1 5.48 12c0-.73.13-1.43.35-2.09V7.07H2.14A11 11 0 0 0 1 12c0 1.77.42 3.44 1.14 4.93l3.69-2.84Z" />
      <path fill="#EA4335" d="M12 5.37c1.62 0 3.06.56 4.2 1.64l3.17-3.17A10.65 10.65 0 0 0 12 1a11 11 0 0 0-9.86 6.07l3.69 2.84c.87-2.6 3.3-4.54 6.17-4.54Z" />
    </svg>
  )
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'RS'
}

export function AccountButton({ compact = false }) {
  const { profile, loading, openAuth } = useAuth()

  return (
    <button
      className={`account-button ${profile ? 'is-authenticated' : ''} ${compact ? 'is-compact' : ''}`}
      type="button"
      onClick={openAuth}
      aria-label={profile ? `Open account for ${profile.name}` : 'Sign in'}
    >
      {profile?.avatar ? (
        <img src={profile.avatar} alt="" referrerPolicy="no-referrer" />
      ) : profile ? (
        <span className="account-initials" aria-hidden="true">{initials(profile.name)}</span>
      ) : (
        <UserRound size={16} aria-hidden="true" />
      )}
      {!compact && <span>{loading ? 'Checking...' : profile?.name?.split(' ')[0] || 'Sign in'}</span>}
    </button>
  )
}

export function AuthModal() {
  const copy = useSiteCopy().authModal
  const {
    authOpen,
    closeAuth,
    profile,
    isOwner,
    configured,
    authPending,
    error,
    signInWithGoogle,
    signOut,
  } = useAuth()
  const primaryActionRef = useRef(null)

  useEffect(() => {
    if (!authOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => primaryActionRef.current?.focus(), 50)

    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeAuth()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [authOpen, closeAuth])

  if (!authOpen) return null

  return createPortal(
    <div className="auth-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeAuth()}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" type="button" onClick={closeAuth} aria-label="Close account dialog">
          <X size={18} />
        </button>
        <div className="auth-fold" aria-hidden="true"><RunwayMark /></div>

        {profile ? (
          <>
            <p className="eyebrow">ACCOUNT</p>
            <h2 id="auth-title">Good to see you, {profile.name.split(' ')[0]}.</h2>
            <div className="auth-profile-card">
              {profile.avatar ? (
                <img src={profile.avatar} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span>{initials(profile.name)}</span>
              )}
              <div>
                <strong>{profile.name}</strong>
                <small>{profile.email}</small>
              </div>
            </div>
            <Link className="button primary auth-library-link" to="/account" onClick={closeAuth} ref={primaryActionRef}>
              <Library size={17} /> Purchase library
            </Link>
            {isOwner && (
              <Link className="button text auth-admin-link" to="/admin" onClick={closeAuth}>
                <ShieldCheck size={17} /> Owner dashboard
              </Link>
            )}
            <button className="button text auth-signout" type="button" onClick={signOut} disabled={authPending}>
              <LogOut size={16} /> {authPending ? 'Signing out...' : 'Sign out'}
            </button>
          </>
        ) : (
          <>
            <p className="eyebrow">YOUR RUNWAY</p>
            <h2 id="auth-title">{copy.title}</h2>
            <p className="auth-intro">{copy.intro}</p>
            <button className="google-auth-button" type="button" onClick={signInWithGoogle} disabled={authPending} ref={primaryActionRef}>
              {authPending ? <span className="auth-spinner" aria-hidden="true" /> : <GoogleIcon />}
              <span>{authPending ? 'Opening Google...' : 'Continue with Google'}</span>
            </button>
            {!configured && (
              <p className="auth-config-note">Preview mode is active. Add the public Supabase environment values to enable Google sign-in.</p>
            )}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <p className="auth-privacy">Authentication is handled by Supabase. Runway Systems never receives your Google password.</p>
          </>
        )}
      </section>
    </div>,
    document.body,
  )
}
