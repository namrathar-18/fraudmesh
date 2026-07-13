// Lightweight SVG charts shared across modules — no charting dependency.

export function TrendLine({
  values,
  color = '#a855f7',
  height = 60,
  fill = true,
}: {
  values: number[]
  color?: string
  height?: number
  fill?: boolean
}) {
  const w = 100
  const h = height
  if (values.length < 2) return <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }} preserveAspectRatio="none" />
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 6) - 3
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const id = `g${color.replace('#', '')}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={`url(#${id})`} />}
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function HBars({ data }: { data: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map((d) => (
        <div key={d.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
            <span style={{ color: 'var(--text-dim)' }}>{d.label}</span>
            <span className="mono" style={{ fontWeight: 700 }}>{d.value.toLocaleString('en-IN')}</span>
          </div>
          <div style={{ height: 8, background: 'var(--bg-2)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: d.color ?? 'var(--accent)', borderRadius: 5, transition: 'width 0.4s' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function Donut({ segments, size = 132 }: { segments: { label: string; value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const r = size / 2 - 12
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-2)" strokeWidth="12" />
          {segments.map((s) => {
            const len = (s.value / total) * c
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="12"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            )
            offset += len
            return el
          })}
        </g>
        <text x="50%" y="47%" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--text)" fontFamily="var(--mono)">{total}</text>
        <text x="50%" y="60%" textAnchor="middle" fontSize="9" fill="var(--text-faint)">total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />
            <span style={{ color: 'var(--text-dim)' }}>{s.label}</span>
            <span className="mono" style={{ marginLeft: 'auto', fontWeight: 700 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Gauge({ value, max = 1, label, color = '#34d399' }: { value: number; max?: number; label: string; color?: string }) {
  const pct = Math.min(1, value / max)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: 'var(--text-dim)' }}>{label}</span>
        <span className="mono" style={{ fontWeight: 700, color }}>{(pct * 100).toFixed(0)}%</span>
      </div>
      <div style={{ height: 8, background: 'var(--bg-2)', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color, borderRadius: 5 }} />
      </div>
    </div>
  )
}
