import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getUserProfile, isSupabaseConfigured, supabase, userIsOwner } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authPending, setAuthPending] = useState(false)
  const [error, setError] = useState('')
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    let active = true

    if (!supabase) {
      setLoading(false)
      return undefined
    }

    // getSession() can reject (offline, CORS, a bad anon key, a stale refresh
    // token). Without a catch the promise never settles the flag and the app
    // sits on "Verifying owner access..." forever, so always clear loading and
    // surface the reason.
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      setLoading(false)
    }).catch((sessionError) => {
      if (!active) return
      setError(sessionError?.message || 'Could not reach the sign-in service. Check your connection and try again.')
      setSession(null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setLoading(false)
      setAuthPending(false)
      if (nextSession) {
        setError('')
        setAuthOpen(false)
      }
    })

    // Fail-safe: whatever happens in this environment, never leave the app
    // stuck on a loading screen. If the session check has not settled in 8s,
    // treat the visitor as signed out so the UI becomes usable.
    const safetyTimer = window.setTimeout(() => {
      if (!active) return
      setLoading((current) => {
        if (current) setError('Sign-in is taking longer than expected. Please reload and try again.')
        return false
      })
    }, 8000)

    return () => {
      active = false
      window.clearTimeout(safetyTimer)
      listener.subscription.unsubscribe()
    }
  }, [])

  const openAuth = useCallback(() => {
    setError('')
    setAuthOpen(true)
  }, [])

  const closeAuth = useCallback(() => {
    if (!authPending) setAuthOpen(false)
  }, [authPending])

  const signInWithGoogle = useCallback(async () => {
    setError('')

    if (!supabase) {
      setError('Google sign-in is ready for configuration. Add the Supabase URL and public anon key to the environment variables.')
      return
    }

    setAuthPending(true)
    // Use a fixed, origin-only redirect target. Never echo the full
    // window.location.href: a victim who lands on
    // /anything?next=https://evil.com should not have the OAuth callback
    // honour that query, and Supabase's own allowlist is the
    // primary defence, not an excuse to forward user input.
    const safeRedirect = `${window.location.origin}/account`
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: safeRedirect,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    })

    if (oauthError) {
      setError(oauthError.message || 'Google sign-in could not be started. Please try again.')
      setAuthPending(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    setAuthPending(true)
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) setError(signOutError.message)
    setAuthPending(false)
  }, [])

  const user = session?.user || null
  const value = useMemo(() => ({
    session,
    user,
    profile: getUserProfile(user),
    isOwner: userIsOwner(user),
    loading,
    authPending,
    error,
    authOpen,
    configured: isSupabaseConfigured,
    openAuth,
    closeAuth,
    signInWithGoogle,
    signOut,
  }), [session, user, loading, authPending, error, authOpen, openAuth, closeAuth, signInWithGoogle, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
