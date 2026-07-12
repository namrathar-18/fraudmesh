import { useState } from 'react'
import { usePipelineState } from '../state/PipelineContext'
import { MetricCards } from '../components/MetricCards'
import { LatencyPanel } from '../components/LatencyPanel'
import { TransactionStream } from '../components/TransactionStream'
import { CaseQueue } from '../components/CaseQueue'
import { CopilotDrawer } from '../components/CopilotDrawer'
import type { DecisionRecord } from '../engine/types'

export function MonitoringPage() {
  const { state, getExplanation, label } = usePipelineState()
  const [sel, setSel] = useState<DecisionRecord | null>(null)

  const active = sel
    ? state.records.find((r) => r.decisionId === sel.decisionId)
      ?? state.audit.find((r) => r.decisionId === sel.decisionId)
      ?? sel
    : null

  return (
    <div className="stack">
      <MetricCards stats={state.stats} />
      <LatencyPanel latency={state.latency} stats={state.stats} />
      <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
        <TransactionStream records={state.records} onSelect={setSel} />
        <CaseQueue cases={state.cases} onSelect={setSel} />
      </div>

      {active && (
        <CopilotDrawer
          record={active}
          explanation={getExplanation(active)}
          onClose={() => setSel(null)}
          onLabel={(id, l) => label(id, l)}
        />
      )}
    </div>
  )
}
