import { Simulator } from './simulator'
import { FeatureStore } from './featureStore'
import { GraphService } from './graph'
import { DriftMonitor } from './drift'
import {
  CHAMPION,
  anomalyScore,
  evaluate,
  modelPredict,
  ruleScore,
  trainChallenger,
  type Model,
  type Sample,
} from './scorer'
import type {
  Decision,
  DecisionRecord,
  DriftPoint,
  GraphEdge,
  GraphNode,
  LatencySample,
  PipelineStats,
} from './types'

const LATENCY_BUDGET_MS = 100
let did = 0
const newDecisionId = () => `dec_${(++did).toString(36)}`

export interface RetrainInfo {
  version: string
  prevPrAuc: number
  newPrAuc: number
  promoted: boolean
  at: number
}

export interface TimelinePoint {
  ts: number
  tps: number
  p99: number
  processed: number
  blocked: number
  saved: number
}

export interface PipelineState {
  records: DecisionRecord[]
  cases: DecisionRecord[]
  stats: PipelineStats
  latency: LatencySample[]
  drift: DriftPoint[]
  nodes: GraphNode[]
  edges: GraphEdge[]
  retrain: RetrainInfo | null
  saved: number
  fraudByType: Record<string, number>
  timeline: TimelinePoint[]
  audit: DecisionRecord[]
}

export class Pipeline {
  private sim: Simulator
  private store = new FeatureStore()
  private graph = new GraphService()
  private drift = new DriftMonitor()
  private model: Model = { ...CHAMPION }

  private records: DecisionRecord[] = []
  private cases: DecisionRecord[] = []
  private history: DecisionRecord[] = [] // labelled, for similar-case retrieval
  private latency: LatencySample[] = []
  private driftSeries: DriftPoint[] = []
  private labelBuffer: Sample[] = []
  private retrain: RetrainInfo | null = null
  private audit: DecisionRecord[] = []
  private timeline: TimelinePoint[] = []
  private amountSaved = 0
  private fraudByType: Record<string, number> = {
    account_takeover: 0,
    mule_network: 0,
    laundering_chain: 0,
  }

  private processed = 0
  private tp = 0
  private fp = 0
  private fn = 0
  private tn = 0
  private degradedCount = 0
  private sinceAnalyze = 0
  private lastRetrainAt = 0
  private windowStart = Date.now()
  private windowCount = 0
  private tps = 0

  constructor(seed = 42) {
    this.sim = new Simulator(seed)
  }

  private simulateLatency(): number {
    // Feature-store read + model inference, in ms. Kept inside the 100ms budget;
    // occasional load spikes stay under the SLO ceiling.
    const base = 6 + Math.random() * 15
    const spike = Math.random() < 0.02 ? 20 + Math.random() * 55 : 0
    return Math.min(LATENCY_BUDGET_MS - 3, Math.round((base + spike) * 10) / 10)
  }

  private decide(score: number): Decision {
    if (score >= 0.75) return 'block'
    if (score >= 0.45) return 'review'
    return 'allow'
  }

  private scoreOne(): DecisionRecord {
    const txn = this.sim.emit()
    // Graph enrichment computed asynchronously enriches THIS read via the store.
    const enrich = this.graph.enrichmentFor(txn.payer)
    this.store.enrich(txn.payer, enrich.muleScore, enrich.ringSize)

    const features = this.store.computeFeatures(txn)
    const latencyMs = this.simulateLatency()
    // Degraded mode = the model circuit-breaker opened (inference timeout or
    // feature-store cache miss); we abort the model and serve the faster
    // rules-only path rather than blow the latency budget.
    const degraded = Math.random() < 0.006

    const rules = ruleScore(features, txn)
    const anomaly = anomalyScore(features)

    let modelScore = 0
    let shap = [] as DecisionRecord['shap']
    if (!degraded) {
      const out = modelPredict(this.model, features)
      modelScore = out.score
      shap = out.shap
    }

    // Blend: in degraded mode we fall back to rules only (fail-safe review bias).
    let score: number
    if (degraded) {
      score = Math.max(rules.score, 0.45) // conservative: never silently allow
    } else {
      score = Math.min(1, 0.6 * modelScore + 0.5 * rules.score)
      if (anomaly > 0.6 && score < 0.45) score = 0.45 // anomaly safety net
    }
    const decision = this.decide(score)

    const reasons = rules.reasons.length
      ? rules.reasons
      : [shap[0] ? `${shap[0].label} drove the model score` : 'Aggregate model risk']

    const rec: DecisionRecord = {
      decisionId: newDecisionId(),
      txn,
      score: round2(score),
      ruleScore: round2(rules.score),
      modelScore: round2(modelScore),
      anomalyScore: anomaly,
      decision,
      reasons,
      shap,
      features,
      ringId: this.graph.enrichmentFor(txn.payee).ringSize > 0 ? 0 : null,
      latencyMs,
      degraded,
      modelVersion: this.model.version,
    }

    // Write paths (after scoring): feature windows + graph + drift + metrics.
    this.store.update(txn)
    this.graph.ingest(txn)
    const d = this.drift.observe(features.amountToMedianRatio)
    this.driftSeries.push({ ts: txn.ts, psi: d.psi, alert: d.alert })
    if (this.driftSeries.length > 140) this.driftSeries.shift()

    this.labelBuffer.push({ f: features, y: txn.truth === 'none' ? 0 : 1 })
    if (this.labelBuffer.length > 600) this.labelBuffer.shift()

    if (d.alert) this.maybeRetrain(txn.ts)

    this.updateMetrics(rec)
    this.latency.push({ ts: txn.ts, ms: latencyMs })
    if (this.latency.length > 120) this.latency.shift()
    if (degraded) this.degradedCount++

    return rec
  }

  private updateMetrics(rec: DecisionRecord) {
    this.processed++
    this.windowCount++
    const actualFraud = rec.txn.truth !== 'none'
    const flagged = rec.decision !== 'allow'
    if (flagged && actualFraud) this.tp++
    else if (flagged && !actualFraud) this.fp++
    else if (!flagged && actualFraud) this.fn++
    else this.tn++

    if (actualFraud) this.fraudByType[rec.txn.truth] = (this.fraudByType[rec.txn.truth] ?? 0) + 1
    if (flagged && actualFraud) this.amountSaved += rec.txn.amount

    this.audit.unshift(rec)
    if (this.audit.length > 250) this.audit.length = 250
  }

  private maybeRetrain(now: number) {
    if (now - this.lastRetrainAt < 6000) return // don't thrash
    if (this.labelBuffer.length < 120) return
    this.lastRetrainAt = now
    const split = Math.floor(this.labelBuffer.length * 0.7)
    const train = this.labelBuffer.slice(0, split)
    const holdout = this.labelBuffer.slice(split)
    const nextVersion = `lgbm-v${parseInt(this.model.version.split('v')[1] || '1') + 1}`
    const challenger = trainChallenger(train, this.model, nextVersion)
    const champEval = evaluate(this.model, holdout)
    const challEval = evaluate(challenger, holdout)
    const promoted = challEval.prAuc >= champEval.prAuc
    if (promoted) this.model = challenger
    this.retrain = {
      version: promoted ? challenger.version : this.model.version,
      prevPrAuc: champEval.prAuc,
      newPrAuc: challEval.prAuc,
      promoted,
      at: now,
    }
  }

  /** Analyst feedback closes the loop: label flows into retraining history. */
  label(decisionId: string, label: 'confirmed_fraud' | 'false_positive') {
    const inCases = this.cases.find((c) => c.decisionId === decisionId)
    const inRecords = this.records.find((c) => c.decisionId === decisionId)
    for (const r of [inCases, inRecords]) if (r) r.label = label
    if (inCases) this.history.push({ ...inCases })
    if (this.history.length > 400) this.history.shift()
  }

  shiftTactics() {
    this.sim.shiftTactics()
  }

  tacticsShifted() {
    return this.sim.tacticsShifted
  }

  step(nTxns: number) {
    for (let i = 0; i < nTxns; i++) {
      const rec = this.scoreOne()
      this.records.unshift(rec)
      if (rec.decision !== 'allow') this.cases.unshift(rec)
    }
    if (this.records.length > 60) this.records.length = 60
    if (this.cases.length > 50) this.cases.length = 50

    this.sinceAnalyze += nTxns
    if (this.sinceAnalyze >= 8) {
      this.graph.analyze() // off the hot path
      this.sinceAnalyze = 0
    }

    // TPS over a rolling ~1s window.
    const now = Date.now()
    if (now - this.windowStart >= 1000) {
      this.tps = Math.round((this.windowCount * 1000) / (now - this.windowStart))
      this.windowStart = now
      this.windowCount = 0
      const ms = this.latency.map((l) => l.ms)
      this.timeline.push({
        ts: now,
        tps: this.tps,
        p99: percentile(ms, 99),
        processed: this.processed,
        blocked: this.tp,
        saved: this.amountSaved,
      })
      if (this.timeline.length > 60) this.timeline.shift()
    }
  }

  getState(): PipelineState {
    const ms = this.latency.map((l) => l.ms)
    const { nodes, edges } = this.graph.snapshot()
    const stats: PipelineStats = {
      processed: this.processed,
      blocked: this.cases.filter((c) => c.decision === 'block').length,
      reviewed: this.cases.filter((c) => c.decision === 'review').length,
      allowed: this.processed - this.tp - this.fp, // approx allowed
      truePositives: this.tp,
      falsePositives: this.fp,
      falseNegatives: this.fn,
      trueNegatives: this.tn,
      degradedCount: this.degradedCount,
      tps: this.tps,
      p50: percentile(ms, 50),
      p95: percentile(ms, 95),
      p99: percentile(ms, 99),
      ringsDetected: this.graph.ringsDetected(),
      driftAlert: this.driftSeries[this.driftSeries.length - 1]?.alert ?? false,
      modelVersion: this.model.version,
    }
    return {
      records: this.records,
      cases: this.cases,
      stats,
      latency: this.latency,
      drift: this.driftSeries,
      nodes,
      edges,
      retrain: this.retrain,
      saved: this.amountSaved,
      fraudByType: { ...this.fraudByType },
      timeline: this.timeline,
      audit: this.audit,
    }
  }

  graphService() {
    return this.graph
  }
  historyRecords() {
    return this.history
  }

  reset(seed = 42) {
    this.sim = new Simulator(seed)
    this.store.reset()
    this.graph.reset()
    this.drift.reset()
    this.model = { ...CHAMPION }
    this.records = []
    this.cases = []
    this.history = []
    this.latency = []
    this.driftSeries = []
    this.labelBuffer = []
    this.retrain = null
    this.audit = []
    this.timeline = []
    this.amountSaved = 0
    this.fraudByType = { account_takeover: 0, mule_network: 0, laundering_chain: 0 }
    this.processed = this.tp = this.fp = this.fn = this.tn = 0
    this.degradedCount = this.sinceAnalyze = 0
    this.windowCount = 0
    this.tps = 0
    this.windowStart = Date.now()
  }
}

function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length))
  return Math.round(s[idx] * 10) / 10
}
const round2 = (n: number) => Math.round(n * 100) / 100
