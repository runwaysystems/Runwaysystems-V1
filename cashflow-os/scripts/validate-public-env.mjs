const REQUIRED_PRODUCTION_VALUES = [
  'VITE_API_BASE_URL',
  'VITE_SUPPORT_EMAIL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
]

const FORBIDDEN_PUBLIC_NAME_PARTS = [
  'SERVICE_ROLE',
  'API_SECRET',
  'WEBHOOK_SECRET',
  'PRIVATE_KEY',
  'ENCRYPTION_KEY',
  'SIGNING_SECRET',
  'RATE_LIMIT_SALT',
  'BREVO_API_KEY',
  'LEMONSQUEEZY_API_KEY',
]

function placeholder(value) {
  return /(^|[._/@-])(your|replace|example|placeholder|changeme)([._/@-]|$)|\.invalid\b/i.test(value)
}

function productionHttpsUrl(name, value, errors) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') errors.push(`${name} must use https`)
    if (/^(localhost|127(?:\.\d+){3}|\[?::1\]?)$/i.test(url.hostname)) errors.push(`${name} cannot target localhost`)
    if (/\.(invalid|test|example)$/i.test(url.hostname)) errors.push(`${name} cannot use a reserved test domain`)
    if (placeholder(value)) errors.push(`${name} still contains a placeholder`)
  } catch {
    errors.push(`${name} must be an absolute URL`)
  }
}

/**
 * Validate values that Vite is about to expose to the browser.
 * Secret-shaped VITE_ names always fail. Required values and production-safe
 * endpoints fail only for an actual Pages/deploy build, preserving zero-config
 * local development and local regression builds.
 */
export function validatePublicBuildEnvironment(env, { production = false } = {}) {
  const errors = []
  const publicEntries = Object.entries(env).filter(([name, value]) => name.startsWith('VITE_') && String(value || '').trim())

  for (const [name] of publicEntries) {
    if (FORBIDDEN_PUBLIC_NAME_PARTS.some((part) => name.includes(part))) {
      errors.push(`${name} looks secret and must not be compiled into browser assets`)
    }
  }

  if (production) {
    for (const name of REQUIRED_PRODUCTION_VALUES) {
      if (!String(env[name] || '').trim()) errors.push(`${name} is required for production builds`)
    }

    const apiUrl = String(env.VITE_API_BASE_URL || '').trim()
    const supabaseUrl = String(env.VITE_SUPABASE_URL || '').trim()
    const supportEmail = String(env.VITE_SUPPORT_EMAIL || '').trim()
    const anonKey = String(env.VITE_SUPABASE_ANON_KEY || '').trim()
    if (apiUrl) productionHttpsUrl('VITE_API_BASE_URL', apiUrl, errors)
    if (supabaseUrl) productionHttpsUrl('VITE_SUPABASE_URL', supabaseUrl, errors)
    if (supportEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)
      || /\.(invalid|test|example)$/i.test(supportEmail.split('@').pop() || '')
      || placeholder(supportEmail))) {
      errors.push('VITE_SUPPORT_EMAIL must be a non-placeholder email address')
    }
    if (anonKey && (!/^(eyJ|sb_publishable_)/.test(anonKey) || anonKey.length < 20 || placeholder(anonKey) || /service[_-]?role/i.test(anonKey))) {
      errors.push('VITE_SUPABASE_ANON_KEY is invalid or looks like a non-public key')
    }

    for (const name of ['VITE_OWNER_EMAIL', 'VITE_TRUSTPILOT_REVIEW_URL']) {
      const value = String(env[name] || '').trim()
      if (value && placeholder(value)) errors.push(`${name} still contains a placeholder`)
    }
  }

  if (errors.length) {
    throw new Error(`Public build environment validation failed:\n- ${[...new Set(errors)].join('\n- ')}`)
  }
}
