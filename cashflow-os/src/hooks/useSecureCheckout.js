import { useCallback, useState } from 'react'
import { createCheckoutSession } from '../api/platformApi'
import { useAuth } from '../context/AuthContext'

export function useSecureCheckout() {
  const { session, profile, loading, openAuth } = useAuth()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const startCheckout = useCallback(async (productKeys, bundleKey = '', consentSource = 'cart') => {
    if (pending || loading) return
    if (!profile || !session?.access_token) {
      openAuth()
      return
    }

    setPending(true)
    setError('')
    try {
      const checkout = await createCheckoutSession(productKeys, { token: session.access_token, bundleKey, consent: true, consentSource })
      if (!checkout?.url) throw new Error('Lemon Squeezy did not return a checkout URL.')
      const destination = new URL(checkout.url)
      const allowedHost = destination.protocol === 'https:' && (
        destination.hostname === 'lemonsqueezy.com'
        || destination.hostname.endsWith('.lemonsqueezy.com')
      )
      if (!allowedHost) {
        throw new Error('The checkout destination could not be verified.')
      }
      window.location.assign(destination.toString())
    } catch (checkoutError) {
      setError(checkoutError.message || 'Secure checkout could not be started. Please try again.')
      setPending(false)
    }
  }, [loading, openAuth, pending, profile, session?.access_token])

  return {
    startCheckout,
    checkoutPending: pending,
    checkoutError: error,
    clearCheckoutError: () => setError(''),
  }
}
