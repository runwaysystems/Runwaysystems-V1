// Single source of truth for "is this product allowed on the storefront".
//
// Visibility is owned by the `active` column in the database. The public
// config (/config/public) only ever lists active products, so a product that
// is absent from a successfully loaded config is hidden and must not be
// rendered anywhere on the storefront.
//
// The subtlety that caused hidden products to keep showing is that "absent"
// has two very different meanings:
//
//   1. the config loaded fine and the product is genuinely hidden, and
//   2. the config could not be loaded at all (Worker down, network error),
//      in which case every product looks "absent".
//
// Treating case 2 like case 1 would blank the whole catalog during an outage,
// so the pages used to fall back to the built-in catalog whenever a product
// was missing. That fallback also resurrected deliberately hidden products.
// Tagging the config with a load status separates the two cases: the catalog
// is only authoritative once a request actually succeeded.

export const CONFIG_READY = 'ready'
export const CONFIG_UNAVAILABLE = 'unavailable'

// True once /config/public has been fetched successfully. Only then may a
// missing product be interpreted as "hidden by the owner".
export function catalogIsAuthoritative(config) {
  return config?.configStatus === CONFIG_READY
}

// The products the storefront is allowed to show. When the config is
// authoritative this is exactly the active list, even when it is empty
// (the owner may legitimately hide everything). Otherwise the caller's
// fallback keeps the site readable through an outage.
export function storefrontProducts(config, fallbackProducts = []) {
  if (catalogIsAuthoritative(config)) return config.products || []
  return config?.products?.length ? config.products : fallbackProducts
}

// True when this key must be treated as hidden or deleted.
export function productIsUnavailable(config, key) {
  if (!catalogIsAuthoritative(config)) return false
  return !(config.products || []).some((product) => product.key === key)
}
