import { createContext, useContext, useState, useEffect } from 'react'
import { tokenStore, getMe, logout as apiLogout } from '../api'

const AuthContext = createContext(null)

const BACKEND_TO_FRONTEND_ROLE = {
  DFO: 'DFO',
  STATE_ADMIN: 'STATE_ADMIN',
  AUDIT: 'AUDIT_OFFICER',
  SCHEME_VERIFIER: 'SCHEME_VERIFIER',
  USER: 'USER',
}

export const DEFAULT_PATHS = {
  DFO:             '/dfo/dashboard',
  STATE_ADMIN:     '/admin/gujarat-map',
  AUDIT_OFFICER:   '/audit/overview',
  SCHEME_VERIFIER: '/verifier/my-cases',
  USER:            '/user/dashboard',
}

export function AuthProvider({ children }) {
  const [role, setRole]       = useState(null)
  const [officer, setOfficer] = useState(null)
  const [loading, setLoading] = useState(() => !!tokenStore.get())

  // ── Restore session from localStorage on mount ────────────────────────
  useEffect(() => {
    const storedUser = tokenStore.getUser()
    const token      = tokenStore.get()

    if (token && storedUser) {
      const frontendRole = BACKEND_TO_FRONTEND_ROLE[storedUser.role] || storedUser.role
      getMe()
        .then(me => {
          if (me?.role) {
            // Update profile_complete from server
            const updatedUser = {
              ...storedUser,
              profile_complete: me.profile_complete ?? storedUser.profile_complete ?? true,
            }
            tokenStore.setUser(updatedUser)
            setOfficer(updatedUser)
            setRole(frontendRole)
          } else {
            tokenStore.clear()
          }
        })
        .catch(() => tokenStore.clear())
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }

    // Listen for token expiry (emitted by axios 401 interceptor)
    const onExpired = () => {
      setRole(null)
      setOfficer(null)
    }
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  const handleLogin = (frontendRole, data) => {
    setRole(frontendRole)
    setOfficer(data || null)
    // Update localStorage with profile_complete
    if (data) {
      tokenStore.setUser({
        officer_id:       data.officer_id,
        role:             data.role,
        name:             data.name,
        district:         data.district,
        profile_complete: data.profile_complete ?? true,
      })
    }
  }

  const handleLogout = async () => {
    await apiLogout()
    setRole(null)
    setOfficer(null)
  }

  return (
    <AuthContext.Provider value={{ role, officer, loading, login: handleLogin, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
