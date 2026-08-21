import { useCallback, useEffect, useState } from 'react'
import { getPublicConfig, subscribeToPlatformData } from '../api/platformApi'
import { setPublicConfigCache } from '../lib/publicConfigCache'
import { CONFIG_READY, CONFIG_UNAVAILABLE } from '../lib/catalogAvailability'

// Loads the public platform config (products, Trustpilot review URL, support email).
// Returns null while loading. Preview mode resolves through the localStorage
// adapter with the same shape as the Worker response.
//
// Every resolved config carries a configStatus so consumers can distinguish a
// successful load that legitimately contains no product (owner hid it) from a
// failed load (Worker unreachable). Without that flag an empty product list is
// ambiguous, and the storefront used to resolve the ambiguity by falling back
// to the built-in catalog, which put hidden products back on the site.
export function usePublicProducts() {
  const [config, setConfig] = useState(null)

  const load = useCallback((signal) => {
    getPublicConfig()
      .then((next) => {
        if (signal?.aborted) return
        const resolved = { products: [], ...(next || {}), configStatus: CONFIG_READY }
        setPublicConfigCache(resolved)
        setConfig(resolved)
      })
      .catch(() => {
        // Keep the last good config if we ever had one: a transient refetch
        // failure must not retire products that are genuinely on sale.
        if (!signal?.aborted) {
          setConfig((current) => current || { products: [], configStatus: CONFIG_UNAVAILABLE })
        }
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
