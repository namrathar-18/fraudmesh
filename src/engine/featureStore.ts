import type { FeatureSnapshot, Transaction } from './types'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

interface Ev {
  ts: number
  amount: number
  device: string
  payer: string
}

/**
 * In-browser stand-in for the Redis online feature store. Maintains rolling,
 * TTL-bounded aggregates per entity. The SAME computeFeatures() code path is
 * used at both training time and serving time, which is how we avoid
 * train/serve skew — see engine/scorer trainOffline().
 */
export class FeatureStore {
  private byPayer = new Map<string, Ev[]>()
  private byPayee = new Map<string, Ev[]>()
  private firstSeen = new Map<string, number>()
  private amountHistory = new Map<string, number[]>()
  // Graph enrichment written back asynchronously (kept out of the hot path).
  private enrichment = new Map<string, { muleScore: number; ringSize: number }>()

  private prune(list: Ev[], now: number, ttl: number): Ev[] {
    const cutoff = now - ttl
    // Events are appended in time order, so drop from the front.
    let i = 0
    while (i < list.length && list[i].ts < cutoff) i++
    return i > 0 ? list.slice(i) : list
  }

  private push(map: Map<string, Ev[]>, key: string, ev: Ev, ttl: number) {
    const cur = this.prune(map.get(key) ?? [], ev.ts, ttl)
    cur.push(ev)
    map.set(key, cur)
  }

  /** Read features for scoring WITHOUT mutating windows (serving read). */
  computeFeatures(txn: Transaction): FeatureSnapshot {
    const now = txn.ts
    const payerEvents = this.prune(this.byPayer.get(txn.payer) ?? [], now, DAY)
    const last5m = payerEvents.filter((e) => e.ts >= now - 5 * MIN)
    const devices24h = new Set(payerEvents.map((e) => e.device))
    if (!devices24h.has(txn.deviceId)) devices24h.add(txn.deviceId)

    const hist = this.amountHistory.get(txn.payer) ?? []
    const median = hist.length ? medianOf(hist) : txn.amount
    const ratio = median > 0 ? txn.amount / median : 1

    // Fan-in is only a fraud signal for P2P transfers (mule collectors). For
    // merchant channels a high distinct-payer count is normal and allowlisted,
    // so it must not contribute risk.
    const payeeEvents = this.prune(this.byPayee.get(txn.payee) ?? [], now, DAY)
    const payeeInDegree = txn.channel === 'P2P'
      ? new Set(payeeEvents.map((e) => e.payer).concat(txn.payer)).size
      : 1

    const seen = this.firstSeen.get(txn.payer) ?? now
    const ageHours = Math.max(0, (now - seen) / HOUR)

    // "New device" is only a signal once we've actually seen the account
    // before — a brand-new account with no history isn't inherently a new
    // device, and treating it as one would flood the queue with false positives.
    const knownDevice = payerEvents.some((e) => e.device === txn.deviceId)
    const newDevice = payerEvents.length > 0 && !knownDevice
    const hour = new Date(now).getHours()
    const enrich = this.enrichment.get(txn.payer) ?? { muleScore: 0, ringSize: 0 }
    const velocity5m = last5m.reduce((s, e) => s + e.amount, 0) + txn.amount

    return {
      txnCount5m: last5m.length,
      distinctDevices24h: devices24h.size,
      amountToMedianRatio: round2(ratio),
      payeeInDegree,
      payerAgeHours: Math.round(ageHours),
      newDevice,
      nightHour: hour >= 0 && hour <= 5,
      ringMuleScore: round2(enrich.muleScore),
      ringSize: enrich.ringSize,
      velocityAmount5m: Math.round(velocity5m),
    }
  }

  /** Commit the event to the rolling windows (write path, after scoring). */
  update(txn: Transaction) {
    const ev: Ev = { ts: txn.ts, amount: txn.amount, device: txn.deviceId, payer: txn.payer }
    this.push(this.byPayer, txn.payer, ev, DAY)
    this.push(this.byPayee, txn.payee, ev, DAY)
    if (!this.firstSeen.has(txn.payer)) this.firstSeen.set(txn.payer, txn.ts)
    const hist = this.amountHistory.get(txn.payer) ?? []
    hist.push(txn.amount)
    if (hist.length > 50) hist.shift()
    this.amountHistory.set(txn.payer, hist)
  }

  /** Graph service writes ring risk back here to enrich the NEXT transaction. */
  enrich(account: string, muleScore: number, ringSize: number) {
    this.enrichment.set(account, { muleScore, ringSize })
  }

  reset() {
    this.byPayer.clear()
    this.byPayee.clear()
    this.firstSeen.clear()
    this.amountHistory.clear()
    this.enrichment.clear()
  }
}

function medianOf(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const round2 = (n: number) => Math.round(n * 100) / 100
