import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// The browser client only receives Supabase's public anon key. Service-role keys
// must stay in the Cloudflare Worker environment and must never enter this app.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null

export const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL || '').trim().toLowerCase()

export function getUserProfile(user) {
  if (!user) return null

  const metadata = user.user_metadata || {}
  const name = metadata.full_name || metadata.name || user.email?.split('@')[0] || 'Cash Flow OS user'

  return {
    id: user.id,
    name,
    email: user.email || '',
    avatar: metadata.avatar_url || metadata.picture || '',
  }
}

export function userIsOwner(user) {
  if (!user) return false
  // Only app_metadata is trusted for role authorization. Supabase users can
  // edit user_metadata themselves, so it must never unlock owner controls.
  const role = user.app_metadata?.role
  const emailMatches = Boolean(OWNER_EMAIL && user.email?.toLowerCase() === OWNER_EMAIL)
  return role === 'owner' || emailMatches
}
