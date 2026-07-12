import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { authenticate, clearSession, loadSession, saveSession, type User } from './auth'

interface AuthCtx {
  user: User | null
  login: (email: string, password: string) => boolean
  loginAs: (user: User) => void
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadSession())

  const login = useCallback((email: string, password: string) => {
    const u = authenticate(email, password)
    if (u) {
      setUser(u)
      saveSession(u)
      return true
    }
    return false
  }, [])

  const loginAs = useCallback((u: User) => {
    setUser(u)
    saveSession(u)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, login, loginAs, logout }), [user, login, loginAs, logout])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
