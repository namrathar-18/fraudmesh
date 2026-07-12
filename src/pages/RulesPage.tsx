import { useState } from 'react'
import { RULES } from '../engine/scorer'
import { Sliders } from '../components/icons'

const sevColor: Record<string, string> = { critical: 'var(--red)', high: '#fb923c', medium: 'var(--amber)', low: 'var(--text-dim)' }

export function RulesPage() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(RULES.map((r) => [r.id, r.enabled])),
  )
  const [thresholds, setThresholds] = useState({ block: 75, review: 45 })

  return (
    <div className="stack">
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">Decision Thresholds</div><div className="panel-sub">Score cut-offs mapping to allow / review / block</div></div></div>
          <div className="panel-body">
            <ThresholdSlider label="Block at" value={thresholds.block} color="var(--red)" onChange={(v) => setThresholds((t) => ({ ...t, block: Math.max(t.review + 5, v) }))} />
            <div style={{ height: 18 }} />
            <ThresholdSlider label="Review at" value={thresholds.review} color="var(--amber)" onChange={(v) => setThresholds((t) => ({ ...t, review: Math.min(t.block - 5, v) }))} />
            <div className="thr-legend">
              <span><span className="dot allow" /> allow &lt; {thresholds.review}%</span>
              <span><span className="dot review" /> review {thresholds.review}–{thresholds.block}%</span>
              <span><span className="dot block" /> block ≥ {thresholds.block}%</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">Fallback Policy</div><div className="panel-sub">Behaviour when the model exceeds the 100ms budget</div></div></div>
          <div className="panel-body">
            <div className="policy-opt on"><span className="radio on" /> <div><strong>Rules-only degraded mode</strong><div className="policy-note">Fail-safe: never silently approve — floor risk at “review”. (active)</div></div></div>
            <div className="policy-opt"><span className="radio" /> <div><strong>Approve on timeout</strong><div className="policy-note">Lowest friction, highest fraud exposure.</div></div></div>
            <div className="policy-opt"><span className="radio" /> <div><strong>Decline on timeout</strong><div className="policy-note">Safest, but harms good-customer experience.</div></div></div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div><div className="panel-title"><Sliders size={14} className="" /> Rule Catalogue</div><div className="panel-sub">Hot-path rules — always evaluated inside the latency budget</div></div>
          <span className="badge muted">{Object.values(enabled).filter(Boolean).length}/{RULES.length} active</span>
        </div>
        <div className="panel-body flush">
          <table className="tbl">
            <thead><tr><th>ID</th><th>Rule</th><th>Condition</th><th>Weight</th><th>Severity</th><th>Enabled</th></tr></thead>
            <tbody>
              {RULES.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{r.desc}</td>
                  <td className="mono">+{r.weight.toFixed(2)}</td>
                  <td><span style={{ color: sevColor[r.severity], fontWeight: 650, textTransform: 'capitalize', fontSize: 12 }}>{r.severity}</span></td>
                  <td>
                    <button className={`toggle ${enabled[r.id] ? 'on' : ''}`} onClick={() => setEnabled((e) => ({ ...e, [r.id]: !e[r.id] }))}>
                      <span className="knob" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ThresholdSlider({ label, value, color, onChange }: { label: string; value: number; color: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{label}</span>
        <span className="mono" style={{ fontWeight: 700, color }}>{value}%</span>
      </div>
      <input type="range" min={5} max={95} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ accentColor: color, width: '100%' }} />
    </div>
  )
}
