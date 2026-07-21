import { useMemo, useState } from 'react'
import { usePipelineState } from '../state/PipelineContext'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS } from '../auth/auth'
import { TrendLine, Donut, HBars, Gauge } from '../components/charts'
import { LatencyPanel } from '../components/LatencyPanel'
import { DriftMonitor } from '../components/DriftMonitor'
import { CaseQueue } from '../components/CaseQueue'
import { CopilotDrawer } from '../components/CopilotDrawer'
import { FEATURES, CHAMPION } from '../engine/scorer'
import type { DecisionRecord } from '../engine/types'

const fmtINR = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString('en-IN')}`)

export function OverviewPage() {
  const { user } = useAuth()
  switch (user?.role) {
    case 'admin': return <AdminOverview />
    case 'ml_engineer': return <MlOverview />
    case 'compliance': return <ComplianceOverview />
    default: return <AnalystOverview />
  }
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */
function Band({ title, note }: { title: string; note: string }) {
  const { user } = useAuth()
  if (!user) return null
  return (
    <div className="welcome-band">
      <div>
        <div className="welcome-hi">{title}</div>
        <div className="welcome-role">{user.name} · {ROLE_LABELS[user.role]} · {user.team}</div>
      </div>
      <div className="welcome-focus">
        <div className="wf-title">Shift objective</div>
        <div className="wf-note">{note}</div>
      </div>
    </div>
  )
}

function Kpi({ label, value, foot, tone, spark, color }: { label: string; value: string; foot?: string; tone?: 'good' | 'warn' | 'bad'; spark?: number[]; color?: string }) {
  return (
    <div className="panel metric">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ''}`}>{value}</div>
      {foot && <div className="foot">{foot}</div>}
      {spark && spark.length > 1 && <div style={{ marginTop: 8, opacity: 0.9 }}><TrendLine values={spark} color={color} height={30} /></div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ANALYST — triage cockpit                                            */
/* ------------------------------------------------------------------ */
function AnalystOverview() {
  const { state, getExplanation, label } = usePipelineState()
  const [sel, setSel] = useState<string | null>(null)
  const s = state.stats
  const recall = s.truePositives + s.falseNegatives ? s.truePositives / (s.truePositives + s.falseNegatives) : 0
  const labelled = state.cases.filter((c) => c.label).length
  const blocks = state.cases.filter((c) => c.decision === 'block')
  const active = sel ? state.cases.find((c) => c.decisionId === sel) ?? state.audit.find((c) => c.decisionId === sel) ?? null : null

  return (
    <div className="stack">
      <Band title="Triage Cockpit" note="Work the queue top-down: confirm true fraud, clear false positives — every label retrains the model." />
      <div className="grid grid-4">
        <Kpi label="Open Cases" value={String(state.cases.length)} foot="awaiting your review" tone={state.cases.length > 0 ? 'warn' : undefined} />
        <Kpi label="Blocked (session)" value={String(s.blocked)} foot={`${fmtINR(state.saved)} prevented`} tone="bad" />
        <Kpi label="Labelled by you" value={String(labelled)} foot="fed back to training" tone="good" />
        <Kpi label="Your recall" value={`${(recall * 100).toFixed(0)}%`} foot={`${s.falseNegatives} missed`} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <CaseQueue cases={state.cases} onSelect={(r) => setSel(r.decisionId)} />
        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">High-Value Blocks</div><div className="panel-sub">Prioritise these first</div></div><span className="badge muted">{blocks.length}</span></div>
          <div className="panel-body flush">
            <table className="tbl">
              <thead><tr><th>Amount</th><th>Counterparties</th><th>Signal</th><th>Score</th></tr></thead>
              <tbody>
                {blocks.slice(0, 8).map((r) => (
                  <tr key={r.decisionId} onClick={() => setSel(r.decisionId)} style={{ cursor: 'pointer' }}>
                    <td className="amt">₹{r.txn.amount.toLocaleString('en-IN')}</td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{r.txn.payer}<br />→ {r.txn.payee}</td>
                    <td style={{ color: 'var(--text-dim)', maxWidth: 200 }}>{r.reasons[0]}</td>
                    <td><span className="badge block">{(r.score * 100).toFixed(0)}%</span></td>
                  </tr>
                ))}
                {blocks.length === 0 && <tr><td colSpan={4} className="empty">No blocks yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {active && (
        <CopilotDrawer record={active} explanation={getExplanation(active)} onClose={() => setSel(null)} onLabel={(id, l) => label(id, l)} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ADMIN — platform operations                                         */
/* ------------------------------------------------------------------ */
const SERVICES = [
  { name: 'Scoring service', role: 'Hot-path decisions' },
  { name: 'Redpanda bus', role: 'Transaction stream' },
  { name: 'Redis feature store', role: 'Online features' },
  { name: 'Graph service', role: 'Ring detection' },
  { name: 'PostgreSQL', role: 'Decisions & audit' },
  { name: 'Copilot service', role: 'RAG + tools' },
]
function AdminOverview() {
  const { state } = usePipelineState()
  const s = state.stats
  const tpsSeries = state.timeline.map((t) => t.tps)

  return (
    <div className="stack">
      <Band title="Platform Operations" note="All services nominal. Keep p99 under the 100ms budget and watch degraded-mode fallbacks under load." />
      <div className="grid grid-4">
        <Kpi label="Throughput" value={`${s.tps}`} foot={`${s.processed.toLocaleString('en-IN')} scored`} spark={tpsSeries} color="#f5b301" />
        <Kpi label="p99 Latency" value={`${s.p99.toFixed(0)}ms`} foot="SLO < 100ms" tone={s.p99 < 100 ? 'good' : 'bad'} />
        <Kpi label="Availability" value="99.98%" foot="trailing 30d" tone="good" />
        <Kpi label="Degraded Fallbacks" value={String(s.degradedCount)} foot="rules-only mode" tone={s.degradedCount > 0 ? 'warn' : undefined} />
      </div>

      <div className="panel">
        <div className="panel-head"><div><div className="panel-title">Service Health</div><div className="panel-sub">Live component status across the pipeline</div></div><span className="live"><span className="pulse" /> all systems operational</span></div>
        <div className="panel-body">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {SERVICES.map((svc, i) => (
              <div key={svc.name} className="svc-card">
                <div className="svc-top"><span className="svc-dot" /> <b>{svc.name}</b></div>
                <div className="svc-role">{svc.role}</div>
                <div className="svc-metric mono">{(6 + i * 3 + (s.p50 || 8)).toFixed(0)}ms · 100%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <LatencyPanel latency={state.latency} stats={s} />
        <DriftMonitor drift={state.drift} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ML ENGINEER — model health                                          */
/* ------------------------------------------------------------------ */
function MlOverview() {
  const { state } = usePipelineState()
  const s = state.stats
  const recall = s.truePositives + s.falseNegatives ? s.truePositives / (s.truePositives + s.falseNegatives) : 0
  const precision = s.truePositives + s.falsePositives ? s.truePositives / (s.truePositives + s.falsePositives) : 0
  const importance = FEATURES
    .map((f, i) => ({ label: f.label, value: Math.round(Math.abs(CHAMPION.weights[i]) * 100), color: CHAMPION.weights[i] >= 0 ? '#f5b301' : '#21c07a' }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="stack">
      <Band title="Model Health" note="Champion is serving live traffic. Inject drift to trigger a champion/challenger evaluation and watch PR-AUC." />
      <div className="grid grid-4">
        <Kpi label="Serving Model" value={s.modelVersion} foot="champion" />
        <Kpi label="Recall" value={`${(recall * 100).toFixed(1)}%`} foot="fraud caught" tone="good" />
        <Kpi label="Precision" value={`${(precision * 100).toFixed(1)}%`} foot="alerts correct" />
        <Kpi label="Drift PSI" value={(state.drift[state.drift.length - 1]?.psi ?? 0).toFixed(3)} foot="alert at 0.2" tone={s.driftAlert ? 'warn' : 'good'} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">Feature Importance</div><div className="panel-sub">Champion coefficients (shared train/serve)</div></div></div>
          <div className="panel-body"><HBars data={importance} /></div>
        </div>
        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">Champion / Challenger</div><div className="panel-sub">Shadow evaluation status</div></div></div>
          <div className="panel-body">
            {state.retrain ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Gauge label="Champion PR-AUC" value={state.retrain.prevPrAuc} color="#f5b301" />
                <Gauge label="Challenger PR-AUC" value={state.retrain.newPrAuc} color="#ff8a3d" />
                <div className={`badge ${state.retrain.promoted ? 'allow' : 'muted'}`} style={{ width: 'fit-content' }}>{state.retrain.promoted ? 'promoted' : 'shadow'}</div>
              </div>
            ) : <div className="empty">Use <strong>Inject drift</strong> to run an evaluation.</div>}
          </div>
        </div>
      </div>
      <DriftMonitor drift={state.drift} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* COMPLIANCE — governance                                             */
/* ------------------------------------------------------------------ */
function ComplianceOverview() {
  const { state } = usePipelineState()
  const s = state.stats
  const fb = state.fraudByType
  const donut = useMemo(() => [
    { label: 'Mule network', value: fb.mule_network ?? 0, color: '#f0475f' },
    { label: 'Account takeover', value: fb.account_takeover ?? 0, color: '#f5960a' },
    { label: 'Laundering', value: fb.laundering_chain ?? 0, color: '#c98bff' },
  ], [fb])
  const rows: DecisionRecord[] = state.audit.slice(0, 8)

  return (
    <div className="stack">
      <Band title="Governance & Audit" note="Every automated decision must carry a stored SHAP explanation and an immutable audit entry." />
      <div className="grid grid-4">
        <Kpi label="Decisions Logged" value={s.processed.toLocaleString('en-IN')} foot="this session" />
        <Kpi label="Explainability" value="100%" foot="SHAP on every decision" tone="good" />
        <Kpi label="Retention" value="90d" foot="immutable" />
        <Kpi label="Framework" value="RBI/SOC2" foot="aligned" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">Recent Decisions</div><div className="panel-sub">Audit trail — full record in Compliance module</div></div></div>
          <div className="panel-body flush">
            <table className="tbl">
              <thead><tr><th>Time</th><th>Outcome</th><th>Score</th><th>Model</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.decisionId}>
                    <td className="mono" style={{ fontSize: 11 }}>{new Date(r.txn.ts).toLocaleTimeString()}</td>
                    <td><span className={`badge ${r.decision}`}>{r.decision}</span></td>
                    <td className="mono">{(r.score * 100).toFixed(0)}%</td>
                    <td className="mono">{r.modelVersion}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={4} className="empty">No decisions yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">Attack Mix</div><div className="panel-sub">Confirmed fraud by pattern</div></div></div>
          <div className="panel-body" style={{ display: 'grid', placeItems: 'center', minHeight: 180 }}><Donut segments={donut} /></div>
        </div>
      </div>
    </div>
  )
}
