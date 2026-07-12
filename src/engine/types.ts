// Core domain types for the FraudMesh streaming pipeline.

export type Channel = 'P2P' | 'P2M' | 'BILL' | 'RECHARGE'

export type Decision = 'allow' | 'review' | 'block'

export type FraudScenario =
  | 'none'
  | 'account_takeover'
  | 'mule_network'
  | 'laundering_chain'

/** A raw UPI-like payment event as emitted by the simulator. */
export interface Transaction {
  txnId: string
  ts: number
  payer: string
  payee: string
  amount: number
  deviceId: string
  ip: string
  channel: Channel
  city: string
  lat: number
  lng: number
  /** Ground-truth label injected by the simulator (never seen by the scorer). */
  truth: FraudScenario
}

/** Snapshot of online features read/derived at scoring time. */
export interface FeatureSnapshot {
  txnCount5m: number
  distinctDevices24h: number
  amountToMedianRatio: number
  payeeInDegree: number
  payerAgeHours: number
  newDevice: boolean
  nightHour: boolean
  ringMuleScore: number
  ringSize: number
  velocityAmount5m: number
}

/** A single SHAP-style contribution used for explainability. */
export interface ShapContribution {
  feature: string
  label: string
  value: number // signed push toward (positive) / away from (negative) fraud
}

/** The full decision record persisted for every scored transaction. */
export interface DecisionRecord {
  decisionId: string
  txn: Transaction
  score: number
  ruleScore: number
  modelScore: number
  anomalyScore: number
  decision: Decision
  reasons: string[]
  shap: ShapContribution[]
  features: FeatureSnapshot
  ringId: number | null
  latencyMs: number
  degraded: boolean
  modelVersion: string
  /** Analyst feedback, if any. */
  label?: 'confirmed_fraud' | 'false_positive'
}

export interface GraphNode {
  id: string
  type: 'account' | 'device'
  ringId: number | null
  muleScore: number
  txnCount: number
  flagged: boolean
  // layout
  x: number
  y: number
  vx: number
  vy: number
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
  suspicious: boolean
}

export interface LatencySample {
  ts: number
  ms: number
}

export interface DriftPoint {
  ts: number
  psi: number
  alert: boolean
}

export interface PipelineStats {
  processed: number
  blocked: number
  reviewed: number
  allowed: number
  truePositives: number
  falsePositives: number
  falseNegatives: number
  trueNegatives: number
  degradedCount: number
  tps: number
  p50: number
  p95: number
  p99: number
  ringsDetected: number
  driftAlert: boolean
  modelVersion: string
}
