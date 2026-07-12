import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { usePipelineState } from '../state/PipelineContext'
import { HBars } from '../components/charts'

const color = (d: string) => (d === 'block' ? '#f87171' : d === 'review' ? '#fbbf24' : '#34d399')

export function GeoPage() {
  const { state } = usePipelineState()
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  // Initialise the map once.
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return
    const map = L.map(mapEl.current, {
      center: [22.6, 80.5],
      zoom: 5,
      zoomControl: true,
      attributionControl: true,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: '© OpenStreetMap · © CARTO',
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    // Leaflet needs a size recalculation after mount inside a flex/grid panel.
    setTimeout(() => map.invalidateSize(), 200)
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Redraw markers from the live audit stream.
  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()
    const recent = state.audit.slice(0, 120)
    for (const r of recent) {
      const flagged = r.decision !== 'allow'
      L.circleMarker([r.txn.lat, r.txn.lng], {
        radius: flagged ? 7 : 3.5,
        color: color(r.decision),
        weight: flagged ? 1.5 : 0.5,
        fillColor: color(r.decision),
        fillOpacity: flagged ? 0.55 : 0.35,
      })
        .bindPopup(
          `<div style="font-family:system-ui;font-size:12px">
             <b>₹${r.txn.amount.toLocaleString('en-IN')}</b> · ${r.decision.toUpperCase()}<br/>
             ${r.txn.city} · ${r.txn.channel}<br/>
             <span style="color:#888">${r.txn.payer} → ${r.txn.payee}</span><br/>
             score ${(r.score * 100).toFixed(0)}%
           </div>`,
        )
        .addTo(layer)
    }
  }, [state.audit])

  const cityStats = useMemo(() => {
    const vol = new Map<string, number>()
    const fraud = new Map<string, number>()
    for (const r of state.audit) {
      vol.set(r.txn.city, (vol.get(r.txn.city) ?? 0) + 1)
      if (r.decision !== 'allow') fraud.set(r.txn.city, (fraud.get(r.txn.city) ?? 0) + 1)
    }
    const topVol = [...vol.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([label, value]) => ({ label, value }))
    const topFraud = [...fraud.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([label, value]) => ({ label, value, color: '#f87171' }))
    return { topVol, topFraud }
  }, [state.audit])

  return (
    <div className="stack">
      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">Geographic Intelligence</div>
            <div className="panel-sub">Live transaction geography · fraud clusters surface as red hotspots</div>
          </div>
          <div className="pill-row">
            <span className="pill" style={{ color: 'var(--green)' }}>● allowed</span>
            <span className="pill" style={{ color: 'var(--amber)' }}>● review</span>
            <span className="pill" style={{ color: 'var(--red)' }}>● blocked</span>
          </div>
        </div>
        <div className="panel-body flush">
          <div ref={mapEl} className="map" />
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">Volume by City</div><div className="panel-sub">Transactions processed per location</div></div></div>
          <div className="panel-body">{cityStats.topVol.length ? <HBars data={cityStats.topVol} /> : <div className="empty">Collecting…</div>}</div>
        </div>
        <div className="panel">
          <div className="panel-head"><div><div className="panel-title">Fraud Hotspots</div><div className="panel-sub">Flagged transactions per location</div></div></div>
          <div className="panel-body">{cityStats.topFraud.length ? <HBars data={cityStats.topFraud} /> : <div className="empty">No fraud flagged yet.</div>}</div>
        </div>
      </div>
    </div>
  )
}
