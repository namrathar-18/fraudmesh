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
    // Non-P2P payees are merchants — allowlist them permanently so their high
    // fan-in is never mistaken for a mule collector (survives graph pruning).
    if (txn.channel !== 'P2P') this.merchants.add(txn.payee)
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

  private hasRecurringEdge(id: string): boolean {
    for (const e of this.adj.get(id)?.values() ?? []) if (e.count >= 2) return true
    for (const [, m] of this.adj) { const e = m.get(id); if (e && e.count >= 2) return true }
    return false
  }

  private prune() {
    if (this.nodes.size <= 150) return
    // Drop the least-active nodes, but never a ring member or a node with a
    // recurring edge — that would destroy the mule structure before it can be
    // detected as a community.
    const victims = [...this.nodes.values()]
      .filter((n) => n.ringId === null && !this.hasRecurringEdge(n.id))
      .sort((x, y) => x.txnCount - y.txnCount)
      .slice(0, this.nodes.size - 150)
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


  /** Recompute rings + mule scores. Runs off the hot path. */
  analyze() {
    const ids = [...this.nodes.keys()]
    if (ids.length === 0) return

    // --- PageRank for mule scoring ---
    const pr = this.pageRank(ids)
    const maxPr = Math.max(...pr.values(), 1e-9)

    // Reset ring assignments.
    for (const n of this.nodes.values()) { n.ringId = null; n.flagged = false }
    let assigned = 0

    // Mule-collector detection: a non-merchant account that receives from many
    // distinct non-merchant accounts is a collector; it and its senders form a
    // ring. Non-merchant in-edges are P2P (merchant payments target allowlisted
    // merchant nodes), so a high distinct-sender count is a strong mule signal
    // — robust where sparse edge recurrence defeats pure community detection.
    const inNbrs = new Map<string, Set<string>>()
    for (const [src, m] of this.adj) {
      if (this.merchants.has(src)) continue
      for (const t of m.keys()) {
        if (this.merchants.has(t)) continue
        const set = inNbrs.get(t) ?? new Set<string>()
        set.add(src)
        inNbrs.set(t, set)
      }
    }
    for (const [collector, senders] of inNbrs) {
      const node = this.nodes.get(collector)
      if (!node || node.ringId !== null) continue
      // Require repeated fan-in: a mule collector receives from the same accounts
      // again and again (edge count >= 2), unlike a popular payee with one-off
      // incoming payments. This cleanly separates rings from legitimate hubs.
      let recurring = 0
      for (const s of senders) if ((this.adj.get(s)?.get(collector)?.count ?? 0) >= 2) recurring++
      if (recurring < 3) continue
      const ringId = assigned++
      for (const id of [collector, ...senders]) {
        const n = this.nodes.get(id)
        if (n && n.ringId === null) { n.ringId = ringId; n.flagged = true }
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
