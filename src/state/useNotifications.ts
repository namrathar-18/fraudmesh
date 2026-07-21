import { useEffect, useRef, useState } from 'react'
import type { PipelineState } from '../engine/pipeline'
import type { Role } from '../auth/auth'

export type NotifTone = 'red' | 'amber' | 'green' | 'gold'
export interface Notif {
  id: string
  ts: number
  kind: string
  text: string
  tone: NotifTone
  read: boolean
  roles: Role[] // which roles care about this event
}

let nid = 0

/**
 * Turns pipeline state transitions into a real, timestamped notification feed —
 * edge-triggered (fires once per event), role-scoped, with unread tracking and
 * dismissal. This is what a genuine ops console shows, not a list re-derived
 * from current state on every render.
 */
export function useNotifications(state: PipelineState, role: Role) {
  const [items, setItems] = useState<Notif[]>([])
  const prev = useRef({ drift: false, rings: 0, retrainAt: 0, blockId: '', processed: 0 })

  useEffect(() => {
    const add: Omit<Notif, 'id' | 'read'>[] = []
    const now = Date.now()

    if (state.stats.driftAlert && !prev.current.drift) {
      add.push({ ts: now, kind: 'DRIFT', tone: 'amber', roles: ['admin', 'ml_engineer'],
        text: 'Concept drift detected on the amount distribution — challenger evaluation triggered.' })
    }
    if (state.stats.ringsDetected > prev.current.rings) {
      add.push({ ts: now, kind: 'GRAPH', tone: 'red', roles: ['admin', 'analyst'],
        text: `New fraud ring surfaced — ${state.stats.ringsDetected} ring(s) now under watch.` })
    }
    if (state.retrain && state.retrain.at !== prev.current.retrainAt) {
      add.push({ ts: now, kind: 'MLOPS', tone: state.retrain.promoted ? 'green' : 'gold', roles: ['admin', 'ml_engineer'],
        text: state.retrain.promoted
          ? `Challenger ${state.retrain.version} promoted to champion (PR-AUC ${state.retrain.newPrAuc.toFixed(2)}).`
          : `Challenger held in shadow — did not beat champion (${state.retrain.newPrAuc.toFixed(2)}).` })
    }
    const topBlock = state.audit.find((r) => r.decision === 'block')
    if (topBlock && topBlock.decisionId !== prev.current.blockId && topBlock.txn.amount >= 4000) {
      add.push({ ts: topBlock.txn.ts, kind: 'BLOCK', tone: 'red', roles: ['admin', 'analyst', 'compliance'],
        text: `₹${topBlock.txn.amount.toLocaleString('en-IN')} blocked — ${topBlock.reasons[0]}.` })
    }

    prev.current = {
      drift: state.stats.driftAlert,
      rings: state.stats.ringsDetected,
      retrainAt: state.retrain?.at ?? 0,
      blockId: topBlock?.decisionId ?? prev.current.blockId,
      processed: state.stats.processed,
    }

    if (add.length) {
      setItems((cur) => {
        const next = [
          ...add.map((a) => ({ ...a, id: `n${++nid}`, read: false })),
          ...cur,
        ].slice(0, 40)
        return next
      })
    }
  }, [state])

  const visible = items.filter((n) => n.roles.includes(role) || role === 'admin')
  const unread = visible.filter((n) => !n.read).length
  const markAllRead = () => setItems((cur) => cur.map((n) => ({ ...n, read: true })))
  const dismiss = (id: string) => setItems((cur) => cur.filter((n) => n.id !== id))
  const clear = () => setItems([])

  return { items: visible, unread, markAllRead, dismiss, clear }
}
