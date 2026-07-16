import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { DIRECTORY, ROLE_LABELS, type Role } from '../auth/auth'
import { roleHome } from '../app/nav'
import { GoogleButton } from '../auth/GoogleButton'
import { Shield, Lock, User, Check } from '../components/icons'

const ROLE_ORDER: Role[] = ['analyst', 'admin', 'ml_engineer', 'compliance']

export function LoginPage() {
  const { login, loginAs } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('analyst@fraudmesh.io')
  const [password, setPassword] = useState('Analyst@2025')
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const u = DIRECTORY.find((d) => d.email.toLowerCase() === email.trim().toLowerCase())
    if (login(email, password) && u) nav(roleHome(u.role))
    else setError('Invalid credentials. Use a role account below to sign in.')
  }

  const quick = (role: Role) => {
    const u = DIRECTORY.find((d) => d.role === role)!
    const { password: _pw, ...user } = u
    loginAs(user)
    nav(roleHome(role))
  }

  return (
    <div className="login-wrap">
      <div className="login-hero">
        <div className="brand" style={{ marginBottom: 30 }}>
          <div className="brand-logo" style={{ width: 48, height: 48 }}><Shield size={26} className="" /></div>
          <div>
            <h1 style={{ fontSize: 22 }}>FraudMesh</h1>
            <div className="tag">Enterprise Fraud Intelligence Platform</div>
          </div>
        </div>
        <h2 className="login-headline">Score every payment in <span className="grad">under 100 ms.</span></h2>
        <p className="login-sub">
          Real-time transaction scoring, graph-based ring detection, adaptive drift handling,
          and an AI copilot that explains every decision — in one platform.
        </p>
        <div className="login-feats">
          {[
            'p99 < 100ms scoring SLA with graceful degraded-mode fallback',
            'Graph ML detects mule networks per-transaction models miss',
            'SHAP explainability on every decision — audit & RBI ready',
            'Champion/challenger MLOps that adapts as fraud tactics shift',
          ].map((f) => (
            <div key={f} className="feat"><span className="feat-check"><Check size={13} className="" /></span> {f}</div>
          ))}
        </div>
        <div className="login-stats">
          <div><div className="ls-v">824</div><div className="ls-l">TPS sustained</div></div>
          <div><div className="ls-v">87ms</div><div className="ls-l">p99 latency</div></div>
          <div><div className="ls-v">0.1%</div><div className="ls-l">fraud base rate</div></div>
        </div>
      </div>

      <div className="login-panel">
        <div className="panel" style={{ width: '100%', maxWidth: 380 }}>
          <div className="panel-body" style={{ padding: 26 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Sign in</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 4, marginBottom: 20 }}>
              Access the fraud operations console
            </div>

            <GoogleButton />
            <div className="divider"><span>or sign in with email</span></div>

            <form onSubmit={submit}>
              <label className="field">
                <span><User size={13} className="" /> Work email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              </label>
              <label className="field">
                <span><Lock size={13} className="" /> Password</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </label>
              {error && <div className="field-error">{error}</div>}
              <button className="btn primary" type="submit" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}>
                Sign in
              </button>
            </form>

            <div className="quick-roles">
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Sign in by role
              </div>
              <div className="role-grid">
                {ROLE_ORDER.map((r) => (
                  <button key={r} className="role-btn" onClick={() => quick(r)}>{ROLE_LABELS[r]}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 16, textAlign: 'center' }}>
          Protected by role-based access control · SOC2-aligned audit logging
        </div>
      </div>
    </div>
  )
}
