import { useMemo } from 'react'
import { usePipelineState } from '../state/PipelineContext'
import { RingGraph } from '../components/RingGraph'

export function GraphPage() {
  const { state } = usePipelineState()

  const rings = useMemo(() => {
    const map = new Map<number, { id: number; members: string[]; maxMule: number; flow: number }>()
    for (const n of state.nodes) {
      if (n.ringId === null) continue
      const r = map.get(n.ringId) ?? { id: n.ringId, members: [], maxMule: 0, flow: 0 }
      r.members.push(n.id)
      r.maxMule = Math.max(r.maxMule, n.muleScore)
      r.flow += n.txnCount
      map.set(n.ringId, r)
    }
    return [...map.values()].sort((a, b) => b.members.length - a.members.length)
  }, [state.nodes])

  const topMules = useMemo(
    () => [...state.nodes].filter((n) => n.muleScore > 0.2).sort((a, b) => b.muleScore - a.muleScore).slice(0, 8),
    [state.nodes],
  )

  return (
    <div className="stack">
      <RingGraph nodes={state.nodes} edges={state.edges} ringsDetected={state.stats.ringsDetected} />

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Detected Rings</div>
              <div className="panel-sub">Communities flagged by Louvain + device-sharing analysis</div>
            </div>
            <span className={`badge ${rings.length ? 'block' : 'muted'}`}>{rings.length}</span>
          </div>
          <div className="panel-body flush">
            <table className="tbl">
              <thead><tr><th>Ring</th><th>Accounts</th><th>Max mule score</th><th>Flow</th><th>Status</th></tr></thead>
              <tbody>
                {rings.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">RING-{String(r.id + 1).padStart(2, '0')}</td>
                    <td>{r.members.length}</td>
                    <td className="mono">{r.maxMule.toFixed(2)}</td>
                    <td>{r.flow} txns</td>
                    <td><span className="badge block">under watch</span></td>
                  </tr>
                ))}
                {rings.length === 0 && <tr><td colSpan={5} className="empty">No rings detected yet — the graph service is still accumulating edges.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Top Suspected Mule Accounts</div>
              <div className="panel-sub">Ranked by PageRank-derived mule score</div>
            </div>
          </div>
          <div className="panel-body flush">
            <table className="tbl">
              <thead><tr><th>Account</th><th>Mule score</th><th>Ring</th><th>Txns</th></tr></thead>
              <tbody>
                {topMules.map((n) => (
                  <tr key={n.id}>
                    <td className="mono" style={{ fontSize: 11.5 }}>{n.id}</td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <span className="mono">{n.muleScore.toFixed(2)}</span>
                        <span style={{ flex: 1, height: 6, background: 'var(--bg-2)', borderRadius: 4, overflow: 'hidden', maxWidth: 80 }}>
                          <span style={{ display: 'block', height: '100%', width: `${n.muleScore * 100}%`, background: n.flagged ? 'var(--red)' : 'var(--amber)' }} />
                        </span>
                      </div>
                    </td>
                    <td>{n.ringId !== null ? `RING-${String(n.ringId + 1).padStart(2, '0')}` : '—'}</td>
                    <td>{n.txnCount}</td>
                  </tr>
                ))}
                {topMules.length === 0 && <tr><td colSpan={4} className="empty">No elevated mule scores yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
