import { Fragment, useState } from 'react'
import { usePipelineState } from '../state/PipelineContext'
import { FileCheck, Download, Check } from '../components/icons'

const shortId = (id: string) => id.split('_')[1]?.toUpperCase() ?? id.slice(-4)

export function CompliancePage() {
  const { state } = usePipelineState()
  const [expanded, setExpanded] = useState<string | null>(null)

  const rows = state.audit.slice(0, 60)

  return (
    <div className="stack">
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <Tile label="Decisions logged" value={state.stats.processed.toLocaleString('en-IN')} />
        <Tile label="Explainability coverage" value="100%" tone="good" />
        <Tile label="Retention" value="90 days" />
        <Tile label="Framework" value="RBI / SOC2" />
      </div>

      <div className="banner promoted" style={{ marginBottom: 0 }}>
        <Check size={16} className="" />
        Every automated decision carries a stored SHAP explanation and immutable audit entry — satisfying the “right to explanation” expectation for automated financial decisions.
      </div>

      <div className="panel">
        <div className="panel-head">
          <div><div className="panel-title"><FileCheck size={14} className="" /> Decision Audit Log</div><div className="panel-sub">Immutable record of every scored transaction · click to expand the explainability record</div></div>
          <button className="btn"><Download size={15} className="" /> Export (JSON)</button>
        </div>
        <div className="panel-body flush">
          <table className="tbl">
            <thead><tr><th>Decision ID</th><th>Time</th><th>Outcome</th><th>Score</th><th>Model</th><th>Latency</th><th>Mode</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.decisionId}>
                  <tr onClick={() => setExpanded(expanded === r.decisionId ? null : r.decisionId)} style={{ cursor: 'pointer' }}>
                    <td className="mono">#{shortId(r.decisionId)}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{new Date(r.txn.ts).toLocaleTimeString()}</td>
                    <td><span className={`badge ${r.decision}`}>{r.decision}</span></td>
                    <td className="mono">{(r.score * 100).toFixed(0)}%</td>
                    <td className="mono">{r.modelVersion}</td>
                    <td className="mono">{r.latencyMs.toFixed(0)}ms</td>
                    <td>{r.degraded ? <span className="badge review">degraded</span> : <span className="badge muted">normal</span>}</td>
                  </tr>
                  {expanded === r.decisionId && (
                    <tr>
                      <td colSpan={7} style={{ background: 'var(--bg-2)', padding: 16 }}>
                        <div className="section-title">Explainability record — {r.txn.txnId}</div>
                        <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 10 }}>{r.txn.payer} → {r.txn.payee} · ₹{r.txn.amount.toLocaleString('en-IN')} · {r.txn.channel}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 8 }}>
                          {r.shap.slice(0, 6).map((sh) => (
                            <div key={sh.feature} className="kv" style={{ borderBottom: 'none' }}>
                              <span className="k">{sh.label}</span>
                              <span className="v" style={{ color: sh.value >= 0 ? 'var(--red)' : 'var(--green)' }}>{sh.value >= 0 ? '+' : ''}{sh.value.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="empty">No decisions logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'good' }) {
  return <div className="panel metric"><div className="label">{label}</div><div className={`value ${tone ?? ''}`} style={{ fontSize: 22 }}>{value}</div></div>
}
