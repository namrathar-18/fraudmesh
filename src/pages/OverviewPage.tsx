import { usePipelineState } from '../state/PipelineContext'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS, type Role } from '../auth/auth'
import { TrendLine, Donut } from '../components/charts'
import { LatencyPanel } from '../components/LatencyPanel'
import { DriftMonitor } from '../components/DriftMonitor'

const fmtINR = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString('en-IN')}`)

const ROLE_FOCUS: Record<Role, { title: string; note: string }> = {
  analyst: { title: 'Your triage focus', note: 'Prioritise blocked high-value cases and confirm/clear them to feed retraining.' },
  admin: { title: 'Platform health', note: 'All services nominal. Watch the p99 SLO and degraded-mode fallbacks under load.' },
  ml_engineer: { title: 'Model health', note: 'Champion is serving. Inject drift to trigger a champion/challenger evaluation.' },
  compliance: { title: 'Governance view', note: 'Every decision carries a stored SHAP explanation and immutable audit trail.' },
}

export function OverviewPage() {
  const { state } = usePipelineState()
  const { user } = useAuth()
  const focus = user ? ROLE_FOCUS[user.role] : null
  const s = state.stats
  const recall = s.truePositives + s.falseNegatives ? s.truePositives / (s.truePositives + s.falseNegatives) : 0
  const precision = s.truePositives + s.falsePositives ? s.truePositives / (s.truePositives + s.falsePositives) : 0

  const savedSeries = state.timeline.map((t) => t.saved)
  const tpsSeries = state.timeline.map((t) => t.tps)

  const fb = state.fraudByType
  const donut = [
    { label: 'Mule network', value: fb.mule_network ?? 0, color: '#f0475f' },
    { label: 'Account takeover', value: fb.account_takeover ?? 0, color: '#f5960a' },
    { label: 'Laundering chain', value: fb.laundering_chain ?? 0, color: '#c98bff' },
  ]

  const topBlocks = state.audit.filter((r) => r.decision === 'block').slice(0, 6)

  return (
    <div className="stack">
      {user && focus && (
        <div className="welcome-band">
          <div>
            <div className="welcome-hi">Welcome back, {user.name.split(' ')[0]}</div>
            <div className="welcome-role">{ROLE_LABELS[user.role]} · {user.team}</div>
          </div>
          <div className="welcome-focus">
            <div className="wf-title">{focus.title}</div>
            <div className="wf-note">{focus.note}</div>
          </div>
        </div>
      )}
      <div className="grid grid-4">
        <Kpi label="Fraud Prevented" value={fmtINR(state.saved)} foot={`${s.truePositives} fraudulent txns stopped`} tone="good" spark={savedSeries} color="#21c07a" />
        <Kpi label="Transactions Scored" value={s.processed.toLocaleString('en-IN')} foot={`${s.tps} tps · ${s.degradedCount} degraded`} spark={tpsSeries} color="#f5b301" />
        <Kpi label="p99 Latency" value={`${s.p99.toFixed(0)}ms`} foot={`SLO < 100ms · p50 ${s.p50.toFixed(0)}ms`} tone={s.p99 < 100 ? 'good' : 'bad'} />
        <Kpi label="Active Fraud Rings" value={String(s.ringsDetected)} foot={`${s.blocked} blocked · ${s.reviewed} in review`} tone={s.ringsDetected > 0 ? 'warn' : undefined} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Detection Performance</div>
              <div className="panel-sub">Precision-recall on a 0.1% fraud base rate — accuracy would be misleading</div>
            </div>
          </div>
          <div className="panel-body">
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
              <MiniStat k="Recall" v={`${(recall * 100).toFixed(1)}%`} note="fraud caught" />
              <MiniStat k="Precision" v={`${(precision * 100).toFixed(1)}%`} note="of alerts correct" />
              <MiniStat k="False negatives" v={String(s.falseNegatives)} note="fraud missed" tone="bad" />
              <MiniStat k="Model" v={s.modelVersion} note="champion" />
            </div>
            <div style={{ marginTop: 18 }}>
              <div className="section-title">Throughput (last 60s)</div>
              <TrendLine values={tpsSeries.length > 1 ? tpsSeries : [0, 0]} color="#f5b301" height={70} />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Fraud Composition</div>
              <div className="panel-sub">Confirmed fraud by attack pattern</div>
            </div>
          </div>
          <div className="panel-body" style={{ display: 'grid', placeItems: 'center', minHeight: 180 }}>
            <Donut segments={donut} />
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <LatencyPanel latency={state.latency} stats={s} />
        <DriftMonitor drift={state.drift} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Recent High-Value Blocks</div>
          <span className="badge muted">{topBlocks.length}</span>
        </div>
        <div className="panel-body flush">
          <table className="tbl">
            <thead><tr><th>Amount</th><th>Payer → Payee</th><th>Primary reason</th><th>Score</th><th>Latency</th></tr></thead>
            <tbody>
              {topBlocks.map((r) => (
                <tr key={r.decisionId}>
                  <td className="amt">₹{r.txn.amount.toLocaleString('en-IN')}</td>
                  <td className="mono" style={{ color: 'var(--text-dim)', fontSize: 11.5 }}>{r.txn.payer} → {r.txn.payee}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{r.reasons[0]}</td>
                  <td><span className="badge block">{(r.score * 100).toFixed(0)}%</span></td>
                  <td className="mono">{r.latencyMs.toFixed(0)}ms</td>
                </tr>
              ))}
              {topBlocks.length === 0 && <tr><td colSpan={5} className="empty">No blocks yet — pipeline is warming up.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, foot, tone, spark, color }: { label: string; value: string; foot: string; tone?: 'good' | 'warn' | 'bad'; spark?: number[]; color?: string }) {
  return (
    <div className="panel metric">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ''}`}>{value}</div>
      <div className="foot">{foot}</div>
      {spark && spark.length > 1 && <div style={{ marginTop: 8, opacity: 0.9 }}><TrendLine values={spark} color={color} height={30} /></div>}
    </div>
  )
}
function MiniStat({ k, v, note, tone }: { k: string; v: string; note: string; tone?: 'bad' }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: tone === 'bad' ? 'var(--red)' : 'var(--text)' }}>{v}</div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{note}</div>
    </div>
  )
}
