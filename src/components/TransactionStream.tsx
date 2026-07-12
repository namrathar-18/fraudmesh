import type { DecisionRecord } from '../engine/types'

const scoreColor = (d: string) => (d === 'block' ? 'var(--red)' : d === 'review' ? 'var(--amber)' : 'var(--green)')

export function TransactionStream({
  records,
  onSelect,
}: {
  records: DecisionRecord[]
  onSelect: (r: DecisionRecord) => void
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Live Scored Stream</div>
          <div className="panel-sub">Every payment scored in-budget · click any row for the copilot explanation</div>
        </div>
        <span className="live"><span className="pulse" /> streaming</span>
      </div>
      <div className="panel-body flush">
        <div className="stream">
          {records.length === 0 && <div className="empty">Waiting for transactions…</div>}
          {records.map((r) => (
            <div key={r.decisionId} className="txn fresh" onClick={() => onSelect(r)}>
              <div className="score-chip" style={{ color: scoreColor(r.decision) }}>
                {(r.score * 100).toFixed(0)}%
              </div>
              <div className="flow">
                <div className="parties">
                  <span className="mono">{r.txn.payer}</span>
                  <span style={{ color: 'var(--text-faint)' }}> → </span>
                  <span className="mono">{r.txn.payee}</span>
                </div>
                <div className="meta">
                  {r.txn.channel} · {r.features.newDevice ? 'new device' : 'known device'} · {r.latencyMs.toFixed(0)}ms
                  {r.degraded && <span style={{ color: 'var(--amber)' }}> · degraded</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="amt">₹{r.txn.amount.toLocaleString('en-IN')}</div>
                <span className={`badge ${r.decision}`} style={{ marginTop: 4 }}>
                  <span className={`dot ${r.decision}`} /> {r.decision}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
