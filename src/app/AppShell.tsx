import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS } from '../auth/auth'
import { navForRole, NAV } from './nav'
import { usePipelineState } from '../state/PipelineContext'
import { useNotifications } from '../state/useNotifications'
import { Shield, Bell, Search, LogOut, Play, Pause, Zap, Reset, Menu, Close } from '../components/icons'

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export function AppShell() {
  const { user, logout } = useAuth()
  const { state, running, setRunning, tacticsShifted, shiftTactics, reset } = usePipelineState()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const loc = useLocation()

  const items = useMemo(() => (user ? navForRole(user.role) : []), [user])
  const groups = useMemo(() => {
    const g: Record<string, typeof items> = {}
    for (const it of items) (g[it.group] ??= []).push(it)
    return g
  }, [items])

  const current = NAV.find((n) => n.path === loc.pathname)

  const notif = useNotifications(state, user?.role ?? 'analyst')

  const openNotifs = () => {
    setNotifOpen((v) => {
      if (!v) notif.markAllRead()
      return !v
    })
  }

  if (!user) return null

  return (
    <div className="shell">
      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}
      <aside className={`sidebar${navOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo"><Shield size={22} className="" /></div>
          <div>
            <div style={{ fontWeight: 750, fontSize: 16 }}>FraudMesh</div>
            <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em' }}>ENTERPRISE · v1.0</div>
          </div>
          <button className="nav-close" onClick={() => setNavOpen(false)}><Close size={18} className="" /></button>
        </div>

        <nav className="sidebar-nav">
          {Object.entries(groups).map(([group, gitems]) => (
            <div key={group} className="nav-group">
              <div className="nav-group-label">{group}</div>
              {gitems.map((it) => (
                <NavLink key={it.id} to={it.path} onClick={() => setNavOpen(false)} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                  <it.icon size={17} className="" />
                  <span>{it.label}</span>
                  {it.id === 'investigations' && state.cases.length > 0 && <span className="nav-count">{state.cases.length}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="engine-ctl">
            <button className={`btn ghost ${running ? '' : 'active'}`} onClick={() => setRunning((v) => !v)} style={{ flex: 1, justifyContent: 'center' }}>
              {running ? <><Pause size={14} className="" /> Pause</> : <><Play size={14} className="" /> Resume</>}
            </button>
            <button className="btn ghost" onClick={reset} title="Reset simulation"><Reset size={14} className="" /></button>
          </div>
          <button className="btn ghost" onClick={shiftTactics} disabled={tacticsShifted} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
            <Zap size={14} className="" /> {tacticsShifted ? 'Tactics shifted' : 'Inject drift'}
          </button>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <button className="mobile-menu-btn" onClick={() => setNavOpen(true)}><Menu size={20} className="" /></button>
          <div>
            <div className="topbar-title">{current?.label ?? 'FraudMesh'}</div>
            <div className="topbar-crumb">{current?.group ?? ''} · real-time</div>
          </div>

          <div className="topbar-search">
            <Search size={15} className="" />
            <input placeholder="Search accounts, cases, VPAs…" />
          </div>

          <div className="topbar-right">
            <span className="live"><span className="pulse" /> {state.stats.tps} tps</span>
            <div style={{ position: 'relative' }}>
              <button className={`icon-btn${notif.unread > 0 ? ' has-unread' : ''}`} onClick={openNotifs}>
                <Bell size={17} className="" />
                {notif.unread > 0 && <span className="notif-dot">{notif.unread}</span>}
              </button>
              {notifOpen && (
                <div className="popover popover-wide" onMouseLeave={() => setNotifOpen(false)}>
                  <div className="popover-head between">
                    <span>Notifications</span>
                    {notif.items.length > 0 && (
                      <button className="link-btn" onClick={notif.clear}>Clear all</button>
                    )}
                  </div>
                  <div className="notif-scroll">
                    {notif.items.length === 0 && (
                      <div className="empty" style={{ padding: 26 }}>No alerts yet — the pipeline is running clean.</div>
                    )}
                    {notif.items.map((n) => (
                      <div key={n.id} className="notif">
                        <span className={`notif-tag ${n.tone}`}>{n.kind}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div>{n.text}</div>
                          <div className="notif-time">{timeAgo(n.ts)}</div>
                        </div>
                        <button className="notif-x" onClick={() => notif.dismiss(n.id)} aria-label="dismiss"><Close size={13} className="" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button className="user-chip" onClick={() => setMenuOpen((v) => !v)}>
                <span className="avatar">{user.name.split(' ').map((p) => p[0]).join('')}</span>
                <span style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 650 }}>{user.name}</span>
                  <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-faint)' }}>{ROLE_LABELS[user.role]}</span>
                </span>
              </button>
              {menuOpen && (
                <div className="popover" style={{ right: 0 }} onMouseLeave={() => setMenuOpen(false)}>
                  <div className="popover-head">{user.email}</div>
                  <div className="notif" style={{ color: 'var(--text-dim)' }}>Team · {user.team}</div>
                  <button className="menu-item" onClick={logout}><LogOut size={15} className="" /> Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="ticker">
          <div className="ticker-item"><span className="tk">SYS</span> <b className="ok">OPERATIONAL</b></div>
          <TickerStat label="TPS" value={String(state.stats.tps)} />
          <TickerStat label="p99" value={`${state.stats.p99.toFixed(0)}ms`} tone={state.stats.p99 < 100 ? 'ok' : 'bad'} />
          <TickerStat label="SCORED" value={state.stats.processed.toLocaleString('en-IN')} />
          <TickerStat label="BLOCKED" value={String(state.stats.blocked)} tone="bad" />
          <TickerStat label="RINGS" value={String(state.stats.ringsDetected)} tone={state.stats.ringsDetected > 0 ? 'warn' : undefined} />
          <TickerStat label="SAVED" value={`₹${(state.saved / 1000).toFixed(0)}k`} tone="ok" />
          <TickerStat label="DRIFT" value={state.stats.driftAlert ? 'ALERT' : 'STABLE'} tone={state.stats.driftAlert ? 'warn' : 'ok'} />
          <TickerStat label="MODEL" value={state.stats.modelVersion} />
          <div className="ticker-item ticker-clock"><span className="tk">UTC</span> <b>{new Date().toISOString().slice(11, 19)}</b></div>
        </div>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function TickerStat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' | 'warn' }) {
  return (
    <div className="ticker-item">
      <span className="tk">{label}</span> <b className={tone ?? ''}>{value}</b>
    </div>
  )
}
