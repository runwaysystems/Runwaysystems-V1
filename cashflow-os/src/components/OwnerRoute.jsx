import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function AdminLoading() {
  return (
    <div className="admin-route-loading" role="status">
      <LoaderCircle className="spin" />
      <span>Verifying owner access...</span>
    </div>
  )
}

export function OwnerRoute({ children }) {
  const { user, isOwner, loading } = useAuth()
  if (!isSupabaseConfigured) {
    return (
      <div className="admin-route-loading" role="alert">
        <AlertTriangle />
        <span>
          Sign-in is not configured in this build. Set <code>VITE_SUPABASE_URL</code> and
          {' '}<code>VITE_SUPABASE_ANON_KEY</code> in the Pages build variables and redeploy.
        </span>
      </div>
    )
  }
  if (loading) return <AdminLoading />
  if (!user || !isOwner) return <Navigate to="/" replace state={{ ownerAccessDenied: true }} />
  return children
}

export default OwnerRoute
