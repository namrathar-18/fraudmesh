import { createContext, useContext, type ReactNode } from 'react'
import { usePipeline } from '../hooks/usePipeline'

type PipelineValue = ReturnType<typeof usePipeline>

const Ctx = createContext<PipelineValue | null>(null)

export function PipelineProvider({ children }: { children: ReactNode }) {
  const pipeline = usePipeline()
  return <Ctx.Provider value={pipeline}>{children}</Ctx.Provider>
}

export function usePipelineState() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePipelineState must be used within PipelineProvider')
  return ctx
}
