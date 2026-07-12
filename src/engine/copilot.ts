import type { DecisionRecord } from './types'
import type { GraphService } from './graph'

export interface CopilotEvidence {
  icon: 'shap' | 'graph' | 'device' | 'velocity' | 'case'
  text: string
}

export interface CopilotExplanation {
  headline: string
  summary: string
  evidence: CopilotEvidence[]
  similarCaseId: string | null
  recommendation: string
}

/**
 * Retrieval + tool-grounded fraud-analyst copilot. It NEVER invents facts —
 * every sentence is assembled from the stored SHAP record, the graph service,
 * and retrieved similar cases. Tools: getShapRecord, getRingNeighbors,
 * getDeviceReuse, similarCases.
 */
export function explain(
  rec: DecisionRecord,
  graph: GraphService,
  history: DecisionRecord[],
): CopilotExplanation {
  const evidence: CopilotEvidence[] = []

  // Tool: getShapRecord — top signed contributions from the stored explanation.
  const top = rec.shap.filter((s) => Math.abs(s.value) > 0.05).slice(0, 3)
  for (const s of top) {
    const dir = s.value > 0 ? '+' : '−'
    evidence.push({
      icon: 'shap',
      text: `${s.label}: SHAP ${dir}${Math.abs(s.value).toFixed(2)} toward fraud`,
    })
  }

  // Tool: getDeviceReuse — how many accounts share this device fingerprint.
  const reuse = graph.deviceReuse(rec.txn.deviceId)
  if (reuse >= 2 || rec.features.newDevice) {
    evidence.push({
      icon: 'device',
      text: rec.features.newDevice
        ? `Device ${rec.txn.deviceId} is new for this payer and seen on ${reuse} account(s) this session`
        : `Device ${rec.txn.deviceId} is shared across ${reuse} accounts`,
    })
  }

  // Tool: getRingNeighbors — graph proximity to a confirmed/suspected ring.
  const hops = graph.hopsToRing(rec.txn.payee)
  const neighbors = graph.ringNeighbors(rec.txn.payee)
  if (rec.ringId !== null || hops <= 2) {
    const where = hops === 0 ? 'is inside' : `is ${hops} hop(s) from`
    evidence.push({
      icon: 'graph',
      text: `Receiving account ${where} a suspected mule ring (${neighbors.length} linked accounts, mule score ${rec.features.ringMuleScore.toFixed(2)})`,
    })
  }

  // Tool: velocity signal from the feature snapshot.
  if (rec.features.txnCount5m >= 3) {
    evidence.push({
      icon: 'velocity',
      text: `${rec.features.txnCount5m} transactions in the last 5 minutes (₹${rec.features.velocityAmount5m.toLocaleString('en-IN')} moved)`,
    })
  }

  // Tool: similarCases — retrieve a past decision with the closest SHAP profile.
  const similar = retrieveSimilar(rec, history)

  if (similar) {
    evidence.push({
      icon: 'case',
      text: `Closest prior case #${shortId(similar.decisionId)} was labelled ${
        similar.label === 'false_positive' ? 'a false positive' : 'confirmed fraud'
      }`,
    })
  }

  const headline =
    rec.decision === 'block'
      ? 'Transaction blocked'
      : rec.decision === 'review'
      ? 'Sent to manual review'
      : 'Allowed with low risk'

  const topReason = top[0]?.label ?? 'aggregate risk signals'
  const summary =
    rec.decision === 'allow'
      ? `Risk score ${(rec.score * 100).toFixed(0)}%. No single signal crossed the block threshold; the strongest factor was ${topReason.toLowerCase()}.`
      : `Risk score ${(rec.score * 100).toFixed(0)}% (rules ${(rec.ruleScore * 100).toFixed(
          0,
        )}%, model ${(rec.modelScore * 100).toFixed(0)}%${
          rec.degraded ? ', degraded rules-only mode' : ''
        }). Primary driver: ${topReason.toLowerCase()}.`

  const recommendation =
    rec.decision === 'block'
      ? 'Hold the payment and notify the payer via a step-up check. If the payer confirms, mark as false positive to feed retraining.'
      : rec.decision === 'review'
      ? 'Queue for analyst confirmation within SLA; the counterparty warrants a closer look.'
      : 'No action required. Monitor if the account shows repeated odd-hour activity.'

  return {
    headline,
    summary,
    evidence,
    similarCaseId: similar ? shortId(similar.decisionId) : null,
    recommendation,
  }
}

function retrieveSimilar(rec: DecisionRecord, history: DecisionRecord[]): DecisionRecord | null {
  const target = new Map(rec.shap.map((s) => [s.feature, s.value]))
  let best: DecisionRecord | null = null
  let bestDist = Infinity
  for (const h of history) {
    if (h.decisionId === rec.decisionId || !h.label) continue
    let dist = 0
    for (const s of h.shap) dist += Math.pow((target.get(s.feature) ?? 0) - s.value, 2)
    if (dist < bestDist) { bestDist = dist; best = h }
  }
  return best
}

const shortId = (id: string) => id.split('_')[1]?.toUpperCase() ?? id.slice(-4).toUpperCase()
