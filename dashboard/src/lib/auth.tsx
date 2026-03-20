import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { api } from './api'

interface AuthState {
  token: string | null
  tenantId: string | null
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name?: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ob_token'))
  const [tenantId, setTenantId] = useState<string | null>(() => localStorage.getItem('ob_tenant_id'))

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/api/tenants/login', { email, password })
    localStorage.setItem('ob_token', res.access_token)
    localStorage.setItem('ob_tenant_id', res.tenant_id)
    setToken(res.access_token)
    setTenantId(res.tenant_id)
  }, [])

  const signup = useCallback(async (email: string, password: string, name?: string) => {
    const res = await api.post('/api/tenants/signup', { email, password, name })
    localStorage.setItem('ob_token', res.access_token)
    localStorage.setItem('ob_tenant_id', res.tenant_id)
    setToken(res.access_token)
    setTenantId(res.tenant_id)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('ob_token')
    localStorage.removeItem('ob_tenant_id')
    setToken(null)
    setTenantId(null)
  }, [])

  return (
    <AuthContext.Provider value={{ token, tenantId, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
