export type Role = 'admin' | 'analyst' | 'ml_engineer' | 'compliance'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  team: string
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Platform Admin',
  analyst: 'Fraud Analyst',
  ml_engineer: 'ML Engineer',
  compliance: 'Compliance Officer',
}

// User directory. In production this delegates to the company IdP over
// OIDC/SAML; here credentials are validated client-side. Each role has its own
// account and password.
export const DIRECTORY: Array<User & { password: string }> = [
  { id: 'u1', name: 'Namratha R', email: 'analyst@fraudmesh.io', password: 'Analyst@2025', role: 'analyst', team: 'Risk Operations' },
  { id: 'u2', name: 'Priya Menon', email: 'admin@fraudmesh.io', password: 'Admin@2025', role: 'admin', team: 'Platform' },
  { id: 'u3', name: 'Arjun Rao', email: 'ml@fraudmesh.io', password: 'MLOps@2025', role: 'ml_engineer', team: 'Data Science' },
  { id: 'u4', name: 'Neha Gupta', email: 'compliance@fraudmesh.io', password: 'Comply@2025', role: 'compliance', team: 'Governance & Risk' },
]

const KEY = 'fraudmesh.session'

export function authenticate(email: string, password: string): User | null {
  const found = DIRECTORY.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
  )
  if (!found) return null
  const { password: _pw, ...user } = found
  return user
}

export function loadSession(): User | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function saveSession(user: User) {
  localStorage.setItem(KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(KEY)
}
