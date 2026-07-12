import type { PipelineStats } from '../engine/types'

export function MetricCards({ stats }: { stats: PipelineStats }) {
  const precision = stats.truePositives + stats.falsePositives
    ? stats.truePositives / (stats.truePositives + stats.falsePositives)
    : 0
  const recall = stats.truePositives + stats.falseNegatives
    ? stats.truePositives / (stats.truePositives + stats.falseNegatives)
    : 0

  const p99Class = stats.p99 === 0 ? '' : stats.p99 < 100 ? 'good' : 'bad'

  return (
    <div className="grid grid-metrics">
      <div className="panel metric">
        <div className="label">p99 Scoring Latency</div>
        <div className={`value ${p99Class}`}>{stats.p99.toFixed(0)}<span style={{ fontSize: 14, color: 'var(--text-faint)' }}> ms</span></div>
        <div className="foot">p50 {stats.p50.toFixed(0)}ms · p95 {stats.p95.toFixed(0)}ms · SLO &lt; 100ms</div>
      </div>

      <div className="panel metric">
        <div className="label">Throughput</div>
        <div className="value">{stats.tps}<span style={{ fontSize: 14, color: 'var(--text-faint)' }}> tps</span></div>
        <div className="foot">{stats.processed.toLocaleString('en-IN')} scored · {stats.degradedCount} degraded fallbacks</div>
      </div>

      <div className="panel metric">
        <div className="label">Detection Quality</div>
        <div className="value">{(recall * 100).toFixed(0)}<span style={{ fontSize: 14, color: 'var(--text-faint)' }}>% recall</span></div>
        <div className="foot">precision {(precision * 100).toFixed(0)}% · {stats.falseNegatives} missed · model {stats.modelVersion}</div>
      </div>

      <div className="panel metric">
        <div className="label">Fraud Rings</div>
        <div className={`value ${stats.ringsDetected > 0 ? 'warn' : ''}`}>{stats.ringsDetected}</div>
        <div className="foot">{stats.blocked} blocked · {stats.reviewed} in review queue</div>
      </div>
    </div>
  )
}
