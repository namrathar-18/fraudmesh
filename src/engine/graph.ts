import type { GraphEdge, GraphNode, Transaction } from './types'

interface Adj {
  count: number
}

/**
 * Asynchronous graph-intelligence service. Builds an account money-flow graph
 * from the stream and, off the hot path, runs community detection (label
 * propagation, a Louvain-style approach) plus a PageRank mule score. Ring risk
 * is written back to the feature store to enrich the NEXT transaction.
 */
export class GraphService {
  private nodes = new Map<string, GraphNode>()
  private adj = new Map<string, Map<string, Adj>>()
  private deviceAccounts = new Map<string, Set<string>>()
  private ringCount = 0
  // Merchant-like nodes (pure sinks with many distinct senders) are allowlisted
  // and excluded from ring/mule analysis, exactly as a real platform would.
  private merchants = new Set<string>()

  private ensure(id: string): GraphNode {
    let n = this.nodes.get(id)
    if (!n) {
      n = {
        id,
        type: 'account',
        ringId: null,
        muleScore: 0,
        txnCount: 0,
        flagged: false,
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200,
        vx: 0,
        vy: 0,
      }
      this.nodes.set(id, n)
      this.adj.set(id, new Map())
    }
    return n
  }

  ingest(txn: Transaction) {
    const a = this.ensure(txn.payer)
    const b = this.ensure(txn.payee)
    a.txnCount++
    b.txnCount++
    const edges = this.adj.get(txn.payer)!
    const e = edges.get(txn.payee) ?? { count: 0 }
    e.count++
    edges.set(txn.payee, e)
    // Track device → accounts (device fingerprint reuse is a strong mule signal).
    const set = this.deviceAccounts.get(txn.deviceId) ?? new Set()
    set.add(txn.payer)
    this.deviceAccounts.set(txn.deviceId, set)
    this.prune()
  }

  private prune() {
    if (this.nodes.size <= 140) return
    // Drop the least-active non-ring nodes to keep the view legible.
    const victims = [...this.nodes.values()]
      .filter((n) => n.ringId === null)
      .sort((x, y) => x.txnCount - y.txnCount)
      .slice(0, this.nodes.size - 140)
    for (const v of victims) {
      this.nodes.delete(v.id)
      this.adj.delete(v.id)
      for (const m of this.adj.values()) m.delete(v.id)
    }
  }

  private neighbors(id: string): string[] {
    const out = new Set<string>()
    for (const t of this.adj.get(id)?.keys() ?? []) out.add(t)
    for (const [src, m] of this.adj) if (m.has(id)) out.add(src)
    return [...out]
  }

  // Neighbours connected by a RECURRING edge (combined count >= 2). One-off
  // legitimate payments (weight 1) are ignored so merchant hubs don't merge the
  // whole graph into a single community — only repeated flows (mule funnels,
  // laundering hops) survive, which is exactly the ring structure we want.
  private strongNeighbors(id: string): string[] {
    if (this.merchants.has(id)) return []
    const out = new Set<string>()
    for (const [t, e] of this.adj.get(id) ?? []) {
      if (this.merchants.has(t)) continue
      const back = this.adj.get(t)?.get(id)?.count ?? 0
      if (e.count + back >= 2) out.add(t)
    }
    for (const [src, m] of this.adj) {
      if (this.merchants.has(src)) continue
      const fwd = m.get(id)?.count ?? 0
      const back = this.adj.get(id)?.get(src)?.count ?? 0
      if (fwd + back >= 2) out.add(src)
    }
    return [...out]
  }

  private outDegree(id: string): number {
    return this.adj.get(id)?.size ?? 0
  }

  private recomputeMerchants() {
    this.merchants.clear()
    for (const id of this.nodes.keys()) {
      if (this.outDegree(id) === 0 && this.inDegree(id) >= 5) this.merchants.add(id)
    }
  }

  private inDegree(id: string): number {
    let c = 0
    for (const [src, m] of this.adj) if (src !== id && m.has(id)) c++
    return c
  }

  /** Recompute communities + mule scores. Runs off the hot path. */
  analyze() {
    const ids = [...this.nodes.keys()]
    if (ids.length === 0) return
    this.recomputeMerchants()

    // --- Label propagation over the recurring-edge subgraph ---
    const label = new Map<string, string>()
    ids.forEach((id) => label.set(id, id))
    const strong = new Map(ids.map((id) => [id, this.strongNeighbors(id)]))
    for (let iter = 0; iter < 8; iter++) {
      let changed = false
      for (const id of ids) {
        const counts = new Map<string, number>()
        for (const nb of strong.get(id) ?? []) {
          const l = label.get(nb)!
          const w = (this.adj.get(id)?.get(nb)?.count ?? 0) + (this.adj.get(nb)?.get(id)?.count ?? 0) + 1
          counts.set(l, (counts.get(l) ?? 0) + w)
        }
        if (counts.size === 0) continue
        let best = label.get(id)!
        let bestC = -1
        for (const [l, c] of counts) if (c > bestC) { bestC = c; best = l }
        if (best !== label.get(id)) { label.set(id, best); changed = true }
      }
      if (!changed) break
    }

    // Group into communities.
    const groups = new Map<string, string[]>()
    for (const id of ids) {
      const l = label.get(id)!
      const g = groups.get(l) ?? []
      g.push(id)
      groups.set(l, g)
    }

    // --- PageRank for mule scoring ---
    const pr = this.pageRank(ids)
    const maxPr = Math.max(...pr.values(), 1e-9)

    // Reset ring assignments, then flag suspicious communities. A ring is a
    // SMALL, tightly-connected community that either concentrates fan-in on a
    // collector or shares device fingerprints — not the legit money-flow
    // backbone, which is large and loosely connected.
    for (const n of this.nodes.values()) { n.ringId = null; n.flagged = false }
    let assigned = 0
    for (const rawGroup of groups.values()) {
      const g = rawGroup.filter((id) => !this.merchants.has(id))
      if (g.length < 3 || g.length > 25) continue
      const density = this.internalDensity(g)
      const shared = this.sharesDevices(g)
      const hasCollector = g.some((id) => this.inDegree(id) >= 3)
      if ((density >= 0.4 && hasCollector) || (shared && g.length <= 15)) {
        const ringId = assigned++
        for (const id of g) {
          const n = this.nodes.get(id)!
          n.ringId = ringId
          n.flagged = true
        }
      }
    }
    this.ringCount = assigned

    for (const id of ids) {
      const n = this.nodes.get(id)!
      if (this.merchants.has(id)) { n.muleScore = 0; continue }
      const base = pr.get(id)! / maxPr
      n.muleScore = Math.round((n.ringId !== null ? 0.55 + 0.45 * base : base * 0.4) * 100) / 100
    }
  }

  private internalDensity(group: string[]): number {
    const inside = new Set(group)
    let internal = 0
    let external = 0
    for (const id of group) {
      for (const t of this.adj.get(id)?.keys() ?? []) {
        if (inside.has(t)) internal++
        else external++
      }
    }
    const total = internal + external
    return total ? internal / total : 0
  }

  private sharesDevices(group: string[]): boolean {
    const inside = new Set(group)
    for (const accts of this.deviceAccounts.values()) {
      let n = 0
      for (const a of accts) if (inside.has(a)) n++
      if (n >= 2 && accts.size >= 2) return true
    }
    return false
  }

  private pageRank(ids: string[], d = 0.85, iters = 20): Map<string, number> {
    const pr = new Map(ids.map((id) => [id, 1 / ids.length]))
    const outDeg = new Map(ids.map((id) => [id, [...(this.adj.get(id)?.values() ?? [])].reduce((s, e) => s + e.count, 0)]))
    for (let k = 0; k < iters; k++) {
      const next = new Map(ids.map((id) => [id, (1 - d) / ids.length]))
      for (const id of ids) {
        const deg = outDeg.get(id)!
        if (deg === 0) continue
        for (const [t, e] of this.adj.get(id) ?? []) {
          if (!next.has(t)) continue
          next.set(t, next.get(t)! + (d * pr.get(id)! * e.count) / deg)
        }
      }
      for (const id of ids) pr.set(id, next.get(id)!)
    }
    return pr
  }

  enrichmentFor(account: string): { muleScore: number; ringSize: number } {
    const n = this.nodes.get(account)
    if (!n || n.ringId === null) return { muleScore: n?.muleScore ?? 0, ringSize: 0 }
    const ringSize = [...this.nodes.values()].filter((m) => m.ringId === n.ringId).length
    return { muleScore: n.muleScore, ringSize }
  }

  ringNeighbors(account: string): GraphNode[] {
    const n = this.nodes.get(account)
    if (!n || n.ringId === null) return []
    return [...this.nodes.values()].filter((m) => m.ringId === n.ringId && m.id !== account)
  }

  deviceReuse(device: string): number {
    return this.deviceAccounts.get(device)?.size ?? 1
  }

  hopsToRing(account: string): number {
    // BFS distance from account to the nearest flagged ring node.
    const start = this.nodes.get(account)
    if (!start) return 99
    if (start.flagged) return 0
    const seen = new Set([account])
    let frontier = [account]
    for (let depth = 1; depth <= 4; depth++) {
      const next: string[] = []
      for (const id of frontier) {
        for (const nb of this.neighbors(id)) {
          if (seen.has(nb)) continue
          seen.add(nb)
          if (this.nodes.get(nb)?.flagged) return depth
          next.push(nb)
        }
      }
      frontier = next
    }
    return 99
  }

  snapshot(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const edges: GraphEdge[] = []
    for (const [src, m] of this.adj) {
      const sn = this.nodes.get(src)
      if (!sn) continue
      for (const [tgt, e] of m) {
        const tn = this.nodes.get(tgt)
        if (!tn) continue
        edges.push({
          source: src,
          target: tgt,
          weight: e.count,
          suspicious: sn.ringId !== null && sn.ringId === tn.ringId,
        })
      }
    }
    return { nodes: [...this.nodes.values()], edges }
  }

  ringsDetected() {
    return this.ringCount
  }

  reset() {
    this.nodes.clear()
    this.adj.clear()
    this.deviceAccounts.clear()
    this.merchants.clear()
    this.ringCount = 0
  }
}
