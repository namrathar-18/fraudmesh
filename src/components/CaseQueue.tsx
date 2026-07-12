import type { DecisionRecord } from '../engine/types'

export function CaseQueue({
  cases,
  onSelect,
}: {
  cases: DecisionRecord[]
  onSelect: (r: DecisionRecord) => void
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Case Queue</div>
          <div className="panel-sub">Blocked & flagged transactions awaiting analyst triage</div>
        </div>
        <span className="badge muted">{cases.length} open</span>
      </div>
      <div className="panel-body flush">
        <div className="stream" style={{ maxHeight: 300 }}>
          {cases.length === 0 && <div className="empty">No flagged cases yet — the stream is clean.</div>}
          {cases.map((r) => (
            <div key={r.decisionId} className="case" onClick={() => onSelect(r)}>
              <div className="top">
                <span className={`badge ${r.decision}`}><span className={`dot ${r.decision}`} /> {r.decision}</span>
                <span className="amt">₹{r.txn.amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="reason">
                <span className="mono" style={{ color: 'var(--text-dim)' }}>{r.txn.payer}</span> → <span className="mono" style={{ color: 'var(--text-dim)' }}>{r.txn.payee}</span>
                <br />
                {r.reasons[0]}
                {r.label && (
                  <span className={`badge ${r.label === 'false_positive' ? 'allow' : 'block'}`} style={{ marginLeft: 8 }}>
                    {r.label === 'false_positive' ? 'FP' : 'confirmed'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
