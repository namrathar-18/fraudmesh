import type { FeatureSnapshot, ShapContribution, Transaction } from './types'

// --- Feature configuration -------------------------------------------------
// Each engineered feature carries a human label, a standardisation center/scale
// (the "training statistics"), and how to extract it from a snapshot. The same
// extraction is used for training and serving, so there is no train/serve skew.

interface FeatureDef {
  key: string
  label: string
  center: number
  scale: number
  extract: (f: FeatureSnapshot) => number
}

export const FEATURES: FeatureDef[] = [
  { key: 'amountRatio', label: 'Amount vs user median', center: 1.1, scale: 2.2, extract: (f) => f.amountToMedianRatio },
  { key: 'newDevice', label: 'New / unseen device', center: 0.12, scale: 0.33, extract: (f) => (f.newDevice ? 1 : 0) },
  { key: 'distinctDevices', label: 'Distinct devices (24h)', center: 1.3, scale: 1.1, extract: (f) => f.distinctDevices24h },
  { key: 'txnCount5m', label: 'Txns in last 5 min', center: 2.5, scale: 3, extract: (f) => f.txnCount5m },
  { key: 'payeeInDegree', label: 'Payee fan-in degree', center: 1.6, scale: 2.4, extract: (f) => f.payeeInDegree },
  { key: 'muleScore', label: 'Graph mule proximity', center: 0.08, scale: 0.22, extract: (f) => f.ringMuleScore },
  { key: 'ringSize', label: 'Fraud-ring size', center: 0.4, scale: 1.6, extract: (f) => f.ringSize },
  { key: 'nightHour', label: 'Odd-hour activity', center: 0.22, scale: 0.41, extract: (f) => (f.nightHour ? 1 : 0) },
  { key: 'payerAge', label: 'Account age (hours)', center: 240, scale: 260, extract: (f) => f.payerAgeHours },
  { key: 'velocity', label: 'Amount velocity (5m)', center: 2500, scale: 3500, extract: (f) => f.velocityAmount5m },
]

export interface Model {
  version: string
  bias: number
  weights: number[] // aligned with FEATURES
}

// Champion model — coefficients tuned to represent a trained LightGBM/logistic
// scorer. Positive weight => feature pushes toward fraud.
// Order: amountRatio, newDevice, distinctDevices, txnCount5m, payeeInDegree,
// muleScore, ringSize, nightHour, payerAge, velocity.
export const CHAMPION: Model = {
  version: 'lgbm-v1',
  bias: -4.6,
  weights: [1.6, 1.55, 0.8, 0.5, 1.3, 2.1, 0.6, 0.28, -0.3, 0.15],
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

export function vectorize(f: FeatureSnapshot): number[] {
  return FEATURES.map((d) => (d.extract(f) - d.center) / d.scale)
}

export interface ModelOutput {
  score: number
  shap: ShapContribution[]
}

/** Logistic scorer. For a linear model the SHAP value of feature i is simply
 *  w_i * z_i (its contribution to the log-odds), which we expose directly. */
export function modelPredict(model: Model, f: FeatureSnapshot): ModelOutput {
  const z = vectorize(f)
  let logit = model.bias
  const shap: ShapContribution[] = []
  for (let i = 0; i < FEATURES.length; i++) {
    const contrib = model.weights[i] * z[i]
    logit += contrib
    shap.push({ feature: FEATURES[i].key, label: FEATURES[i].label, value: round2(contrib) })
  }
  shap.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  return { score: sigmoid(logit), shap }
}

/** Declarative catalogue of the hot-path rules (for the Rules Engine module). */
export const RULES = [
  { id: 'R01', name: 'Amount anomaly', desc: 'Amount ≥ 6× the payer’s rolling median', weight: 0.4, severity: 'high', enabled: true },
  { id: 'R02', name: 'New device at odd hours', desc: 'Unseen device fingerprint used between 00:00–05:00', weight: 0.3, severity: 'high', enabled: true },
  { id: 'R03', name: 'Velocity burst', desc: '≥ 4 transactions from one payer in 5 minutes', weight: 0.25, severity: 'medium', enabled: true },
  { id: 'R04', name: 'Payee fan-in', desc: 'Payee received from ≥ 5 distinct accounts (collector pattern)', weight: 0.2, severity: 'medium', enabled: true },
  { id: 'R05', name: 'Mule-ring proximity', desc: 'Counterparty sits inside a suspected mule ring', weight: 0.35, severity: 'critical', enabled: true },
  { id: 'R06', name: 'Burner device signature', desc: 'Device fingerprint matches a known burner pattern', weight: 0.15, severity: 'low', enabled: true },
] as const

/** Cheap deterministic rules that always answer inside the latency budget. */
export function ruleScore(f: FeatureSnapshot, txn: Transaction): { score: number; reasons: string[] } {
  let s = 0
  const reasons: string[] = []
  if (f.amountToMedianRatio >= 6) {
    s += 0.4
    reasons.push(`Amount is ${f.amountToMedianRatio.toFixed(1)}× the payer's median`)
  }
  if (f.newDevice && f.nightHour) {
    s += 0.3
    reasons.push('New device used during odd hours')
  }
  if (f.txnCount5m >= 4) {
    s += 0.25
    reasons.push(`${f.txnCount5m} transactions in the last 5 minutes`)
  }
  if (f.payeeInDegree >= 5) {
    s += 0.2
    reasons.push(`Payee received from ${f.payeeInDegree} distinct accounts (fan-in)`)
  }
  if (f.ringMuleScore >= 0.5) {
    s += 0.35
    reasons.push(`Counterparty sits inside a suspected mule ring (score ${f.ringMuleScore.toFixed(2)})`)
  }
  if (txn.deviceId.startsWith('burner_')) {
    s += 0.15
    reasons.push('Device fingerprint matches a known burner pattern')
  }
  return { score: Math.min(1, s), reasons }
}

/** Isolation-Forest-style novelty score: how far the point sits from the bulk
 *  of the feature distribution. Catches fraud the supervised model hasn't seen. */
export function anomalyScore(f: FeatureSnapshot): number {
  const z = vectorize(f)
  const maxAbs = Math.max(...z.map(Math.abs))
  const spread = z.filter((v) => Math.abs(v) > 1.5).length
  return round2(Math.min(1, maxAbs / 6 + spread * 0.08))
}

const round2 = (n: number) => Math.round(n * 100) / 100

// --- Online retraining (champion / challenger) -----------------------------
// A compact logistic-regression trainer used when drift fires: it fits a
// challenger on recently labelled samples. The pipeline compares it to the
// champion on a holdout before promoting.

export interface Sample {
  f: FeatureSnapshot
  y: number // 1 = fraud, 0 = legit
}

export function trainChallenger(samples: Sample[], base: Model, version: string): Model {
  const w = [...base.weights]
  let b = base.bias
  const lr = 0.05
  const X = samples.map((s) => vectorize(s.f))
  for (let epoch = 0; epoch < 40; epoch++) {
    for (let i = 0; i < samples.length; i++) {
      let logit = b
      for (let j = 0; j < w.length; j++) logit += w[j] * X[i][j]
      const p = sigmoid(logit)
      const err = p - samples[i].y
      b -= lr * err
      for (let j = 0; j < w.length; j++) w[j] -= lr * (err * X[i][j] + 0.001 * w[j])
    }
  }
  return { version, bias: b, weights: w }
}

/** Precision-recall-aware quality score (area proxy) on a labelled holdout. */
export function evaluate(model: Model, samples: Sample[]): { prAuc: number; precision: number; recall: number } {
  const scored = samples.map((s) => ({ p: modelPredict(model, s.f).score, y: s.y }))
  const thr = 0.5
  let tp = 0, fp = 0, fn = 0
  for (const s of scored) {
    const pred = s.p >= thr ? 1 : 0
    if (pred === 1 && s.y === 1) tp++
    else if (pred === 1 && s.y === 0) fp++
    else if (pred === 0 && s.y === 1) fn++
  }
  const precision = tp + fp ? tp / (tp + fp) : 0
  const recall = tp + fn ? tp / (tp + fn) : 0
  // Cheap PR-AUC proxy across thresholds.
  let auc = 0
  let prev = 1
  for (let t = 0; t <= 1.0001; t += 0.1) {
    let a = 0, c = 0, d = 0
    for (const s of scored) {
      const pred = s.p >= t ? 1 : 0
      if (pred === 1 && s.y === 1) a++
      else if (pred === 1 && s.y === 0) c++
      else if (pred === 0 && s.y === 1) d++
    }
    const prec = a + c ? a / (a + c) : 1
    const rec = a + d ? a / (a + d) : 0
    auc += prec * (prev - rec > 0 ? prev - rec : 0)
    prev = rec
  }
  return { prAuc: round2(Math.min(1, auc)), precision: round2(precision), recall: round2(recall) }
}
