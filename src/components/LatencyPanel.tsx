import { useEffect, useRef } from 'react'
import type { LatencySample, PipelineStats } from '../engine/types'
import { Clock } from './icons'

export function LatencyPanel({ latency, stats }: { latency: LatencySample[]; stats: PipelineStats }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const w = cv.clientWidth
    const h = 150
    cv.width = w * dpr
    cv.height = h * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    const pad = { l: 34, r: 10, t: 12, b: 18 }
    const iw = w - pad.l - pad.r
    const ih = h - pad.t - pad.b
    const maxMs = Math.max(120, ...latency.map((l) => l.ms)) * 1.1
    const x = (i: number) => pad.l + (i / Math.max(1, latency.length - 1)) * iw
    const y = (ms: number) => pad.t + ih - (ms / maxMs) * ih

    // grid + y labels
    ctx.font = '10px ui-monospace, monospace'
    ctx.fillStyle = '#5a6885'
    ctx.strokeStyle = 'rgba(28,39,64,0.7)'
    ctx.lineWidth = 1
    for (const ms of [0, 50, 100, 150].filter((m) => m <= maxMs)) {
      const yy = y(ms)
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke()
      ctx.fillText(String(ms), 6, yy + 3)
    }

    // 100ms SLO budget line
    ctx.strokeStyle = 'rgba(248,113,113,0.7)'
    ctx.setLineDash([5, 4])
    ctx.beginPath(); ctx.moveTo(pad.l, y(100)); ctx.lineTo(w - pad.r, y(100)); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(248,113,113,0.9)'
    ctx.fillText('SLO 100', w - pad.r - 48, y(100) - 4)

    if (latency.length > 1) {
      // area
      const grad = ctx.createLinearGradient(0, pad.t, 0, h)
      grad.addColorStop(0, 'rgba(168,85,247,0.28)')
      grad.addColorStop(1, 'rgba(168,85,247,0)')
      ctx.beginPath()
      ctx.moveTo(x(0), y(latency[0].ms))
      latency.forEach((l, i) => ctx.lineTo(x(i), y(l.ms)))
      ctx.lineTo(x(latency.length - 1), pad.t + ih)
      ctx.lineTo(x(0), pad.t + ih)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()
      // line
      ctx.beginPath()
      latency.forEach((l, i) => (i ? ctx.lineTo(x(i), y(l.ms)) : ctx.moveTo(x(i), y(l.ms))))
      ctx.strokeStyle = '#a855f7'
      ctx.lineWidth = 1.6
      ctx.stroke()
      // spikes above budget
      latency.forEach((l, i) => {
        if (l.ms > 100) {
          ctx.beginPath(); ctx.arc(x(i), y(l.ms), 2.6, 0, Math.PI * 2)
          ctx.fillStyle = '#f87171'; ctx.fill()
        }
      })
    }
  }, [latency])

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title"><Clock size={13} className="" /> Scoring Latency</div>
          <div className="panel-sub">Hot-path p50 / p95 / p99 against the 100ms authorization budget</div>
        </div>
        <div className="pill-row">
          <span className="pill">p50 {stats.p50.toFixed(0)}ms</span>
          <span className="pill">p95 {stats.p95.toFixed(0)}ms</span>
          <span className="pill" style={{ color: stats.p99 < 100 ? 'var(--green)' : 'var(--red)', borderColor: stats.p99 < 100 ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)' }}>
            p99 {stats.p99.toFixed(0)}ms
          </span>
        </div>
      </div>
      <div className="panel-body">
        <canvas ref={ref} style={{ height: 150 }} />
      </div>
    </div>
  )
}
