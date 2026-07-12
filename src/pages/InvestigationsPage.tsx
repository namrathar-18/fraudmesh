import { useMemo, useState } from 'react'
import { usePipelineState } from '../state/PipelineContext'
import { CopilotDrawer } from '../components/CopilotDrawer'
import type { DecisionRecord, Decision } from '../engine/types'

type Filter = 'all' | 'block' | 'review' | 'labelled'

const shortId = (id: string) => id.split('_')[1]?.toUpperCase() ?? id.slice(-4)

export function InvestigationsPage() {
  const { state, getExplanation, label } = usePipelineState()
  const [filter, setFilter] = useState<Filter>('all')
  const [selId, setSelId] = useState<string | null>(null)

  const cases = useMemo(() => {
    let list = state.cases
    if (filter === 'block') list = list.filter((c) => c.decision === 'block')
    else if (filter === 'review') list = list.filter((c) => c.decision === 'review')
    else if (filter === 'labelled') list = list.filter((c) => c.label)
    return list
  }, [state.cases, filter])

  const active = selId ? state.cases.find((c) => c.decisionId === selId) ?? state.audit.find((c) => c.decisionId === selId) ?? null : null

  const counts = {
    all: state.cases.length,
    block: state.cases.filter((c) => c.decision === 'block').length,
    review: state.cases.filter((c) => c.decision === 'review').length,
    labelled: state.cases.filter((c) => c.label).length,
  }

  return (
    <div className="stack">
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <Tile label="Open cases" value={counts.all} />
        <Tile label="Blocked" value={counts.block} tone="bad" />
        <Tile label="In review" value={counts.review} tone="warn" />
        <Tile label="Analyst-labelled" value={counts.labelled} tone="good" />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">Case Queue</div>
            <div className="panel-sub">Triage flagged transactions · click a case for the AI copilot workup</div>
          </div>
          <div className="seg">
            {(['all', 'block', 'review', 'labelled'] as Filter[]).map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
        <div className="panel-body flush">
          <table className="tbl">
            <thead>
              <tr><th>Case</th><th>Decision</th><th>Amount</th><th>Counterparties</th><th>Primary signal</th><th>Score</th><th>SLA</th><th>Status</th></tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.decisionId} onClick={() => setSelId(c.decisionId)} style={{ cursor: 'pointer' }}>
                  <td className="mono">#{shortId(c.decisionId)}</td>
                  <td><DecisionBadge d={c.decision} /></td>
                  <td className="amt">₹{c.txn.amount.toLocaleString('en-IN')}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{c.txn.payer}<br />→ {c.txn.payee}</td>
                  <td style={{ color: 'var(--text-dim)', maxWidth: 240 }}>{c.reasons[0]}</td>
                  <td className="mono">{(c.score * 100).toFixed(0)}%</td>
                  <td className="mono" style={{ color: c.decision === 'block' ? 'var(--red)' : 'var(--amber)' }}>{c.decision === 'block' ? '15m' : '2h'}</td>
                  <td>
                    {c.label
                      ? <span className={`badge ${c.label === 'false_positive' ? 'allow' : 'block'}`}>{c.label === 'false_positive' ? 'FP' : 'confirmed'}</span>
                      : <span className="badge muted">open</span>}
                  </td>
                </tr>
              ))}
              {cases.length === 0 && <tr><td colSpan={8} className="empty">No cases match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {active && (
        <CopilotDrawer
          record={active}
          explanation={getExplanation(active)}
          onClose={() => setSelId(null)}
          onLabel={(id, l) => label(id, l)}
        />
      )}
    </div>
  )
}

function DecisionBadge({ d }: { d: Decision }) {
  return <span className={`badge ${d}`}><span className={`dot ${d}`} /> {d}</span>
}
function Tile({ label, value, tone }: { label: string; value: number; tone?: 'bad' | 'warn' | 'good' }) {
  return (
    <div className="panel metric">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ''}`}>{value}</div>
    </div>
  )
}

export type { DecisionRecord }
