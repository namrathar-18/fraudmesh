import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { roleHome } from '../app/nav'
import type { Role, User } from './auth'
import { Building } from '../components/icons'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any
  }
}

// Decode a Google ID-token (JWT) payload client-side. In production the token
// would additionally be verified server-side against Google's public keys.
function decodeJwt(token: string): { sub: string; email: string; name?: string } {
  const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  const json = decodeURIComponent(
    atob(part)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join(''),
  )
  return JSON.parse(json)
}

/** Real "Sign in with Google" via Google Identity Services. New Google users
 *  are provisioned as Fraud Analysts by default. */
export function GoogleButton({ defaultRole = 'analyst' }: { defaultRole?: Role }) {
  const ref = useRef<HTMLDivElement>(null)
  const { loginAs } = useAuth()
  const nav = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!CLIENT_ID || !ref.current) return
    let cancelled = false

    const init = () => {
      if (cancelled || !window.google?.accounts?.id || !ref.current) return
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (resp: { credential: string }) => {
          try {
            const p = decodeJwt(resp.credential)
            const user: User = {
              id: p.sub,
              name: p.name || p.email.split('@')[0],
              email: p.email,
              role: defaultRole,
              team: 'Google Workspace',
            }
            loginAs(user)
            nav(roleHome(defaultRole))
          } catch {
            setError('Could not read the Google sign-in response.')
          }
        },
      })
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 320,
      })
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-gis]')
    if (existing && window.google) {
      init()
    } else if (!existing) {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.defer = true
      s.dataset.gis = 'true'
      s.onload = init
      s.onerror = () => setError('Google sign-in service failed to load.')
      document.body.appendChild(s)
    } else {
      existing.addEventListener('load', init)
    }
    return () => {
      cancelled = true
    }
  }, [loginAs, nav, defaultRole])

  // Without a configured client id we cannot start a real OAuth flow; show a
  // clear, non-misleading disabled state rather than a fake button.
  if (!CLIENT_ID) {
    return (
      <button className="btn ghost sso" disabled title="Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in">
        <Building size={16} className="" /> Continue with Google
      </button>
    )
  }

  return (
    <div>
      <div ref={ref} style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} />
      {error && <div className="field-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  )
}
