import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pipeline, type PipelineState } from '../engine/pipeline'
import { explain, type CopilotExplanation } from '../engine/copilot'
import type { DecisionRecord } from '../engine/types'

const TICK_MS = 350
const SPEED_TO_BATCH: Record<string, number> = { slow: 2, normal: 6, fast: 16 }

export type Speed = keyof typeof SPEED_TO_BATCH

export function usePipeline() {
  const pipe = useMemo(() => new Pipeline(42), [])
  const [state, setState] = useState<PipelineState>(() => pipe.getState())
  const [running, setRunning] = useState(true)
  const [speed, setSpeed] = useState<Speed>('normal')
  const [tacticsShifted, setTacticsShifted] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!running) {
      if (timer.current) window.clearInterval(timer.current)
      timer.current = null
      return
    }
    timer.current = window.setInterval(() => {
      pipe.step(SPEED_TO_BATCH[speed])
      setState(pipe.getState())
    }, TICK_MS)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [running, speed, pipe])

  const shiftTactics = useCallback(() => {
    pipe.shiftTactics()
    setTacticsShifted(true)
  }, [pipe])

  const reset = useCallback(() => {
    pipe.reset()
    setTacticsShifted(false)
    setState(pipe.getState())
  }, [pipe])

  const label = useCallback(
    (id: string, l: 'confirmed_fraud' | 'false_positive') => {
      pipe.label(id, l)
      setState(pipe.getState())
    },
    [pipe],
  )

  const getExplanation = useCallback(
    (rec: DecisionRecord): CopilotExplanation =>
      explain(rec, pipe.graphService(), pipe.historyRecords()),
    [pipe],
  )

  return {
    state,
    running,
    setRunning,
    speed,
    setSpeed,
    tacticsShifted,
    shiftTactics,
    reset,
    label,
    getExplanation,
  }
}
