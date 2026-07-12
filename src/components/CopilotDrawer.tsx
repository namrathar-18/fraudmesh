import type { DecisionRecord } from '../engine/types'
import type { CopilotExplanation, CopilotEvidence } from '../engine/copilot'
import { Bot, Close, Network, Fingerprint, Zap, Doc, Shield } from './icons'

const eviIcon = (k: CopilotEvidence['icon']) => {
  switch (k) {
    case 'graph': return <Network size={15} className="ic" />
    case 'device': return <Fingerprint size={15} className="ic" />
    case 'velocity': return <Zap size={15} className="ic" />
    case 'case': return <Doc size={15} className="ic" />
    default: return <Shield size={15} className="ic" />
  }
}

export function CopilotDrawer({
  record,
  explanation,
  onClose,
  onLabel,
}: {
  record: DecisionRecord
  explanation: CopilotExplanation
  onClose: () => void
  onLabel: (id: string, l: 'confirmed_fraud' | 'false_positive') => void
}) {
  const maxShap = Math.max(0.2, ...record.shap.map((s) => Math.abs(s.value)))
  const f = record.features

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div>
            <span className={`badge ${record.decision}`}><span className={`dot ${record.decision}`} /> {record.decision.toUpperCase()}</span>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>₹{record.txn.amount.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }} className="mono">
              {record.txn.payer} → {record.txn.payee}
            </div>
          </div>
          <button className="btn ghost" onClick={onClose} style={{ padding: 8 }}><Close size={18} className="" /></button>
        </div>

        <div className="drawer-body">
          {/* Copilot narrative */}
          <div className="copilot-card">
            <div className="who"><Bot size={15} className="" /> Fraud Copilot · {explanation.headline}</div>
            <div className="summary">{explanation.summary}</div>
          </div>

          <div className="section-title">Grounded evidence</div>
          <div style={{ marginBottom: 18 }}>
            {explanation.evidence.map((e, i) => (
              <div className="evi" key={i}>
                {eviIcon(e.icon)}
                <span>{e.text}</span>
              </div>
            ))}
          </div>

          <div className="section-title">SHAP attribution</div>
          <div style={{ marginBottom: 18 }}>
            {record.shap.slice(0, 7).map((s) => {
              const pct = (Math.abs(s.value) / maxShap) * 50
              return (
                <div className="shap-row" key={s.feature}>
                  <span className="name">{s.label}</span>
                  <span className="shap-bar">
                    <span className={`fill ${s.value >= 0 ? 'pos' : 'neg'}`} style={{ width: `${pct}%` }} />
                  </span>
                  <span className="num" style={{ color: s.value >= 0 ? 'var(--red)' : 'var(--green)' }}>
                    {s.value >= 0 ? '+' : ''}{s.value.toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="section-title">Feature snapshot</div>
          <div style={{ marginBottom: 18 }}>
            <div className="kv"><span className="k">Model / rules / anomaly</span><span className="v">{(record.modelScore * 100).toFixed(0)}% · {(record.ruleScore * 100).toFixed(0)}% · {(record.anomalyScore * 100).toFixed(0)}%</span></div>
            <div className="kv"><span className="k">Amount vs median</span><span className="v">{f.amountToMedianRatio.toFixed(1)}×</span></div>
            <div className="kv"><span className="k">Txns in 5 min</span><span className="v">{f.txnCount5m}</span></div>
            <div className="kv"><span className="k">Distinct devices (24h)</span><span className="v">{f.distinctDevices24h}</span></div>
            <div className="kv"><span className="k">Payee fan-in</span><span className="v">{f.payeeInDegree}</span></div>
            <div className="kv"><span className="k">Ring mule score / size</span><span className="v">{f.ringMuleScore.toFixed(2)} · {f.ringSize}</span></div>
            <div className="kv"><span className="k">Scored in</span><span className="v">{record.latencyMs.toFixed(1)} ms {record.degraded ? '(degraded)' : ''}</span></div>
            <div className="kv"><span className="k">Model version</span><span className="v">{record.modelVersion}</span></div>
          </div>

          <div className="rec-box"><strong>Recommended action.</strong> {explanation.recommendation}</div>
        </div>

        <div className="drawer-actions">
          <button
            className="btn danger"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => onLabel(record.decisionId, 'confirmed_fraud')}
          >
            Confirm fraud
          </button>
          <button
            className="btn"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => onLabel(record.decisionId, 'false_positive')}
          >
            Mark false-positive
          </button>
        </div>
      </div>
    </>
  )
}
