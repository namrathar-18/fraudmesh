import { useState } from 'react'
import { DIRECTORY, ROLE_LABELS } from '../auth/auth'
import { User, Settings, Check } from '../components/icons'

const integrations = [
  { name: 'Redpanda (Kafka API)', desc: 'Transaction event bus', status: 'connected' },
  { name: 'Redis Feature Store', desc: 'Online rolling features', status: 'connected' },
  { name: 'PostgreSQL + pgvector', desc: 'Decisions, labels, case vectors', status: 'connected' },
  { name: 'Neo4j / Graph service', desc: 'Ring detection & mule scoring', status: 'connected' },
  { name: 'Prometheus + Grafana', desc: 'Latency & throughput SLOs', status: 'connected' },
  { name: 'PagerDuty', desc: 'Drift & incident alerting', status: 'not configured' },
]

const flags = [
  { key: 'graph_enrichment', label: 'Async graph enrichment', on: true },
  { key: 'anomaly_net', label: 'Isolation-forest safety net', on: true },
  { key: 'auto_promote', label: 'Auto-promote challenger on win', on: true },
  { key: 'shadow_only', label: 'Shadow mode (score, never block)', on: false },
]

export function AdminPage() {
  const [flagState, setFlagState] = useState<Record<string, boolean>>(Object.fromEntries(flags.map((f) => [f.key, f.on])))

  return (
    <div className="stack">
      <div className="panel">
        <div className="panel-head"><div><div className="panel-title"><User size={14} className="" /> Users & Roles</div><div className="panel-sub">Role-based access control across all modules</div></div><button className="btn primary">Invite user</button></div>
        <div className="panel-body flush">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Team</th><th>Access</th></tr></thead>
            <tbody>
              {DIRECTORY.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}><span className="avatar sm">{u.name.split(' ').map((p) => p[0]).join('')}</span> {u.name}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{u.email}</td>
                  <td><span className="badge muted">{ROLE_LABELS[u.role]}</span></td>
                  <td style={{ color: 'var(--text-dim)' }}>{u.team}</td>
                  <td><span className="badge allow"><Check size={11} className="" /> active</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <div className="panel">
          <div className="panel-head"><div><div className="panel-title"><Settings size={14} className="" /> Service Integrations</div><div className="panel-sub">Backend components wired into the platform</div></div></div>
          <div className="panel-body flush">
            <table className="tbl">
              <tbody>
                {integrations.map((i) => (
                  <tr key={i.name}>
                    <td style={{ fontWeight: 600 }}>{i.name}<div style={{ fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 400 }}>{i.desc}</div></td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`badge ${i.status === 'connected' ? 'allow' : 'muted'}`}>{i.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">Feature Flags</div><div className="panel-sub">Runtime platform toggles</div></div></div>
          <div className="panel-body">
            {flags.map((f) => (
              <div key={f.key} className="flag-row">
                <span>{f.label}</span>
                <button className={`toggle ${flagState[f.key] ? 'on' : ''}`} onClick={() => setFlagState((s) => ({ ...s, [f.key]: !s[f.key] }))}>
                  <span className="knob" />
                </button>
              </div>
            ))}
            <div style={{ marginTop: 16 }}>
              <div className="section-title">API Key</div>
              <div className="apikey">fm_live_9f2c··········a41d <button className="btn ghost" style={{ padding: '4px 8px' }}>Rotate</button></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
