import { useEffect, useRef } from 'react'
import type { DriftPoint } from '../engine/types'
import { Trend } from './icons'

export function DriftMonitor({ drift }: { drift: DriftPoint[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const alerting = drift[drift.length - 1]?.alert ?? false

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const w = cv.clientWidth
    const h = 120
    cv.width = w * dpr; cv.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const pad = { l: 30, r: 10, t: 10, b: 14 }
    const iw = w - pad.l - pad.r
    const ih = h - pad.t - pad.b
    const maxPsi = Math.max(0.4, ...drift.map((d) => d.psi)) * 1.15
    const x = (i: number) => pad.l + (i / Math.max(1, drift.length - 1)) * iw
    const y = (v: number) => pad.t + ih - (v / maxPsi) * ih

    ctx.font = '10px ui-monospace, monospace'
    ctx.fillStyle = '#5a6885'
    ctx.strokeStyle = 'rgba(28,39,64,0.7)'
    for (const v of [0, 0.2, 0.4].filter((t) => t <= maxPsi)) {
      const yy = y(v)
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke()
      ctx.fillText(v.toFixed(1), 4, yy + 3)
    }
    // 0.2 threshold
    ctx.strokeStyle = 'rgba(245,150,10,0.7)'; ctx.setLineDash([5, 4])
    ctx.beginPath(); ctx.moveTo(pad.l, y(0.2)); ctx.lineTo(w - pad.r, y(0.2)); ctx.stroke()
    ctx.setLineDash([])

    if (drift.length > 1) {
      ctx.beginPath()
      drift.forEach((d, i) => (i ? ctx.lineTo(x(i), y(d.psi)) : ctx.moveTo(x(i), y(d.psi))))
      ctx.strokeStyle = alerting ? '#f5960a' : '#ff8a3d'
      ctx.lineWidth = 1.8; ctx.stroke()
    }
  }, [drift, alerting])

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title"><Trend size={13} className="" /> Concept Drift (PSI)</div>
          <div className="panel-sub">Population Stability Index on amount distribution · alert at 0.2</div>
        </div>
        <span className={`badge ${alerting ? 'review' : 'allow'}`}>{alerting ? 'drift detected' : 'stable'}</span>
      </div>
      <div className="panel-body">
        <canvas ref={ref} style={{ height: 120 }} />
      </div>
    </div>
  )
}
