import { useEffect, useRef } from 'react'
import type { GraphEdge, GraphNode } from '../engine/types'
import { Network } from './icons'

interface Pos { x: number; y: number; vx: number; vy: number }

const RING_COLORS = ['#f87171', '#fbbf24', '#f472b6', '#fb923c', '#a78bfa']

export function RingGraph({
  nodes,
  edges,
  ringsDetected,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  ringsDetected: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataRef = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes, edges })
  const posRef = useRef<Map<string, Pos>>(new Map())

  useEffect(() => {
    dataRef.current = { nodes, edges }
  }, [nodes, edges])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    let raf = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      cv.width = cv.clientWidth * dpr
      cv.height = 340 * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const frame = () => {
      const { nodes: ns, edges: es } = dataRef.current
      const pos = posRef.current
      const W = cv.clientWidth
      const H = 340
      const cx = W / 2
      const cy = H / 2

      // sync positions
      const ids = new Set(ns.map((n) => n.id))
      for (const k of pos.keys()) if (!ids.has(k)) pos.delete(k)
      ns.forEach((n) => {
        if (!pos.has(n.id)) pos.set(n.id, { x: cx + (Math.random() - 0.5) * W * 0.6, y: cy + (Math.random() - 0.5) * H * 0.6, vx: 0, vy: 0 })
      })

      // physics: repulsion + edge springs + gravity + mild ring clustering
      const arr = ns.map((n) => ({ n, p: pos.get(n.id)! }))
      for (let i = 0; i < arr.length; i++) {
        const a = arr[i]
        for (let j = i + 1; j < arr.length; j++) {
          const b = arr[j]
          let dx = a.p.x - b.p.x
          let dy = a.p.y - b.p.y
          let d2 = dx * dx + dy * dy
          if (d2 < 0.01) { dx = Math.random(); dy = Math.random(); d2 = 1 }
          const d = Math.sqrt(d2)
          const rep = 340 / d2
          const fx = (dx / d) * rep
          const fy = (dy / d) * rep
          a.p.vx += fx; a.p.vy += fy
          b.p.vx -= fx; b.p.vy -= fy
        }
        // gravity to center
        a.p.vx += (cx - a.p.x) * 0.006
        a.p.vy += (cy - a.p.y) * 0.006
      }
      const byId = new Map(arr.map((x) => [x.n.id, x.p]))
      for (const e of es) {
        const s = byId.get(e.source)
        const t = byId.get(e.target)
        if (!s || !t) continue
        const dx = t.x - s.x
        const dy = t.y - s.y
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        const target = e.suspicious ? 32 : 70
        const k = (d - target) * 0.012
        const fx = (dx / d) * k
        const fy = (dy / d) * k
        s.vx += fx; s.vy += fy
        t.vx -= fx; t.vy -= fy
      }
      for (const { p } of arr) {
        p.vx *= 0.82; p.vy *= 0.82
        p.x += Math.max(-6, Math.min(6, p.vx))
        p.y += Math.max(-6, Math.min(6, p.vy))
        p.x = Math.max(14, Math.min(W - 14, p.x))
        p.y = Math.max(14, Math.min(H - 14, p.y))
      }

      // draw
      ctx.clearRect(0, 0, W, H)
      // edges
      for (const e of es) {
        const s = byId.get(e.source)
        const t = byId.get(e.target)
        if (!s || !t) continue
        ctx.beginPath()
        ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y)
        ctx.strokeStyle = e.suspicious ? 'rgba(248,113,113,0.5)' : 'rgba(90,104,133,0.22)'
        ctx.lineWidth = e.suspicious ? 1.6 : 0.8
        ctx.stroke()
      }
      // nodes
      for (const { n } of arr) {
        const p = byId.get(n.id)!
        const r = 3 + n.muleScore * 6
        if (n.flagged) {
          const color = RING_COLORS[(n.ringId ?? 0) % RING_COLORS.length]
          ctx.beginPath(); ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2)
          ctx.fillStyle = color + '22'; ctx.fill()
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
          ctx.fillStyle = color; ctx.fill()
          ctx.lineWidth = 1.4; ctx.strokeStyle = '#fff6'; ctx.stroke()
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
          ctx.fillStyle = n.muleScore > 0.4 ? '#7b8db0' : '#39496b'
          ctx.fill()
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title"><Network size={13} className="" /> Fraud-Ring Graph</div>
          <div className="panel-sub">Accounts as nodes, money flows as edges · Louvain community detection</div>
        </div>
        <span className={`badge ${ringsDetected > 0 ? 'block' : 'muted'}`}>
          {ringsDetected} ring{ringsDetected === 1 ? '' : 's'} detected
        </span>
      </div>
      <div className="panel-body flush">
        <div className="graph-wrap">
          <canvas ref={canvasRef} style={{ height: 340 }} />
          <div className="graph-legend">
            <span className="row"><span className="dot" style={{ background: '#39496b' }} /> normal</span>
            <span className="row"><span className="dot" style={{ background: '#7b8db0' }} /> elevated mule score</span>
            <span className="row"><span className="dot" style={{ background: '#f87171' }} /> confirmed ring</span>
          </div>
        </div>
      </div>
    </div>
  )
}
