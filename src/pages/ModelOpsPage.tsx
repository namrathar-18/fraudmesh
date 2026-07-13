import { usePipelineState } from '../state/PipelineContext'
import { FEATURES, CHAMPION } from '../engine/scorer'
import { DriftMonitor } from '../components/DriftMonitor'
import { HBars, Gauge } from '../components/charts'

export function ModelOpsPage() {
  const { state } = usePipelineState()
  const s = state.stats
  const recall = s.truePositives + s.falseNegatives ? s.truePositives / (s.truePositives + s.falseNegatives) : 0
  const precision = s.truePositives + s.falsePositives ? s.truePositives / (s.truePositives + s.falsePositives || 1) : 0

  const importance = FEATURES
    .map((f, i) => ({ label: f.label, value: Math.abs(CHAMPION.weights[i]), color: CHAMPION.weights[i] >= 0 ? '#a855f7' : '#34d399' }))
    .sort((a, b) => b.value - a.value)
    .map((d) => ({ ...d, value: Math.round(d.value * 100) }))

  const registry = [
    { version: 'lgbm-v1', stage: 'Champion', prauc: 0.86, status: s.modelVersion === 'lgbm-v1' ? 'serving' : 'archived' },
    { version: 'lgbm-v2', stage: 'Challenger', prauc: state.retrain?.newPrAuc ?? 0.84, status: s.modelVersion === 'lgbm-v2' ? 'serving' : (state.retrain ? 'shadow' : 'not trained') },
    { version: 'iforest-v1', stage: 'Anomaly', prauc: 0.71, status: 'serving' },
  ]

  return (
    <div className="stack">
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <Tile label="Serving model" value={s.modelVersion} />
        <Tile label="Recall" value={`${(recall * 100).toFixed(1)}%`} tone="good" />
        <Tile label="Precision" value={`${(precision * 100).toFixed(1)}%`} />
        <Tile label="Drift (PSI)" value={(state.drift[state.drift.length - 1]?.psi ?? 0).toFixed(3)} tone={s.driftAlert ? 'warn' : 'good'} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">Model Registry</div><div className="panel-sub">Champion / challenger with shadow evaluation</div></div></div>
          <div className="panel-body flush">
            <table className="tbl">
              <thead><tr><th>Version</th><th>Stage</th><th>PR-AUC</th><th>Status</th></tr></thead>
              <tbody>
                {registry.map((m) => (
                  <tr key={m.version}>
                    <td className="mono">{m.version}</td>
                    <td>{m.stage}</td>
                    <td className="mono">{m.prauc.toFixed(2)}</td>
                    <td><span className={`badge ${m.status === 'serving' ? 'allow' : m.status === 'shadow' ? 'review' : 'muted'}`}>{m.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">Champion/Challenger</div><div className="panel-sub">Shadow-scores live traffic; promoted only if it beats champion</div></div></div>
          <div className="panel-body">
            {state.retrain ? (
              <>
                <div className={`banner ${state.retrain.promoted ? 'promoted' : ''}`} style={{ margin: 0 }}>
                  {state.retrain.promoted
                    ? `${state.retrain.version} promoted — PR-AUC ${state.retrain.prevPrAuc.toFixed(2)} → ${state.retrain.newPrAuc.toFixed(2)}`
                    : `Challenger kept in shadow — PR-AUC ${state.retrain.newPrAuc.toFixed(2)} ≤ champion ${state.retrain.prevPrAuc.toFixed(2)}`}
                </div>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Gauge label="Champion PR-AUC" value={state.retrain.prevPrAuc} color="#a855f7" />
                  <Gauge label="Challenger PR-AUC" value={state.retrain.newPrAuc} color="#ec4899" />
                </div>
              </>
            ) : (
              <div className="empty">No retrain cycle yet. Use <strong>Inject drift</strong> in the sidebar to trigger a champion/challenger evaluation.</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">Feature Importance</div><div className="panel-sub">Champion coefficient magnitude (shared train/serve features)</div></div></div>
          <div className="panel-body"><HBars data={importance} /></div>
        </div>
        <DriftMonitor drift={state.drift} />
      </div>
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="panel metric">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ''}`} style={{ fontSize: 22 }}>{value}</div>
    </div>
  )
}
