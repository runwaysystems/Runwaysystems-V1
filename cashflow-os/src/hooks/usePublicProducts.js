import { useCallback, useEffect, useState } from 'react'
import { getPublicConfig, subscribeToPlatformData } from '../api/platformApi'
import { setPublicConfigCache } from '../lib/publicConfigCache'

// Loads the public platform config (products, Trustpilot URL, review policy).
// Returns null while loading. Preview mode resolves through the localStorage
// adapter with the same shape as the Worker response.
export function usePublicProducts() {
  const [config, setConfig] = useState(null)

  const load = useCallback((signal) => {
    getPublicConfig()
      .then((next) => {
        if (signal?.aborted) return
        setPublicConfigCache(next || { products: [] })
        setConfig(next || { products: [] })
      })
      .catch(() => {
        if (!signal?.aborted) setConfig((current) => current || { products: [] })
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)

    // The config is otherwise fetched once per page load, so an open
    // storefront tab keeps showing the old catalog after the owner saves a
    // change. Refetch when the tab is focused again (the usual "edit in the
    // dashboard tab, switch back to the site tab" flow) and when the preview
    // adapter reports a local write.
    const refresh = () => {
      if (document.visibilityState === 'visible') load(controller.signal)
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    const unsubscribe = subscribeToPlatformData(refresh)

    return () => {
      controller.abort()
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      unsubscribe()
    }
  }, [load])

  return config
}
