import { usePipelineState } from '../state/PipelineContext'
import { TrendLine, Donut, HBars } from '../components/charts'
import { Download } from '../components/icons'

export function AnalyticsPage() {
  const { state } = usePipelineState()
  const s = state.stats
  const fb = state.fraudByType

  const savedSeries = state.timeline.map((t) => t.saved)
  const tpsSeries = state.timeline.map((t) => t.tps)
  const p99Series = state.timeline.map((t) => t.p99)

  const donut = [
    { label: 'Mule network', value: fb.mule_network ?? 0, color: '#f0475f' },
    { label: 'Account takeover', value: fb.account_takeover ?? 0, color: '#f5960a' },
    { label: 'Laundering', value: fb.laundering_chain ?? 0, color: '#c98bff' },
  ]

  const confusion = [
    { label: 'True positives (fraud caught)', value: s.truePositives, color: '#21c07a' },
    { label: 'False positives (good blocked)', value: s.falsePositives, color: '#f5960a' },
    { label: 'False negatives (fraud missed)', value: s.falseNegatives, color: '#f0475f' },
    { label: 'True negatives (clean allowed)', value: s.trueNegatives, color: '#3a3350' },
  ]

  return (
    <div className="stack">
      <div className="row between">
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Reporting window · live session</div>
        <button className="btn"><Download size={15} className="" /> Export report (CSV)</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <Chart title="Fraud Prevented (₹)" sub="cumulative savings"><TrendLine values={ensure(savedSeries)} color="#21c07a" height={90} /></Chart>
        <Chart title="Throughput (TPS)" sub="rolling per-second"><TrendLine values={ensure(tpsSeries)} color="#f5b301" height={90} /></Chart>
        <Chart title="p99 Latency (ms)" sub="against 100ms SLO"><TrendLine values={ensure(p99Series)} color="#ff8a3d" height={90} /></Chart>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">Attack Mix</div><div className="panel-sub">Confirmed fraud by pattern</div></div></div>
          <div className="panel-body" style={{ display: 'grid', placeItems: 'center', minHeight: 180 }}><Donut segments={donut} /></div>
        </div>
        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">Confusion Matrix</div><div className="panel-sub">Outcome counts on live traffic</div></div></div>
          <div className="panel-body"><HBars data={confusion} /></div>
        </div>
      </div>
    </div>
  )
}

const ensure = (a: number[]) => (a.length > 1 ? a : [0, 0])

function Chart({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="panel-head"><div><div className="panel-title">{title}</div><div className="panel-sub">{sub}</div></div></div>
      <div className="panel-body">{children}</div>
    </div>
  )
}
