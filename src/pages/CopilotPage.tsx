import { useEffect, useMemo, useRef, useState } from 'react'
import { usePipelineState } from '../state/PipelineContext'
import type { CopilotExplanation } from '../engine/copilot'
import type { DecisionRecord } from '../engine/types'
import { Bot, User, Shield } from '../components/icons'

interface Msg { who: 'user' | 'bot'; text: string; evidence?: string[] }

const shortId = (id: string) => id.split('_')[1]?.toUpperCase() ?? id.slice(-4)

export function CopilotPage() {
  const { state, getExplanation, label } = usePipelineState()
  const [selId, setSelId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const scroller = useRef<HTMLDivElement>(null)

  const queue = state.cases.slice(0, 20)
  const rec = selId ? state.cases.find((c) => c.decisionId === selId) ?? state.audit.find((c) => c.decisionId === selId) ?? null : null

  const exp: CopilotExplanation | null = useMemo(() => (rec ? getExplanation(rec) : null), [rec, getExplanation])

  useEffect(() => {
    if (rec && exp) {
      setMsgs([{ who: 'bot', text: `${exp.headline}. ${exp.summary}`, evidence: exp.evidence.map((e) => e.text) }])
    }
  }, [rec?.decisionId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [msgs])

  const ask = (q: string) => {
    if (!rec || !exp) return
    let answer: Msg
    if (q.startsWith('Why')) {
      answer = { who: 'bot', text: `The decision was driven primarily by ${rec.shap[0]?.label.toLowerCase() ?? 'aggregate risk'}. Full attribution:`, evidence: rec.shap.slice(0, 4).map((s) => `${s.label}: ${s.value >= 0 ? '+' : ''}${s.value.toFixed(2)}`) }
    } else if (q.startsWith('ring')) {
      answer = { who: 'bot', text: exp.evidence.find((e) => e.icon === 'graph')?.text ?? 'This counterparty is not currently linked to a known ring.' }
    } else if (q.startsWith('similar')) {
      answer = { who: 'bot', text: exp.similarCaseId ? `The closest prior case is #${exp.similarCaseId}, retrieved by SHAP-profile similarity.` : 'No sufficiently similar labelled case is in the retrieval store yet.' }
    } else {
      answer = { who: 'bot', text: `Recommended action: ${exp.recommendation}` }
    }
    setMsgs((m) => [...m, { who: 'user', text: q }, answer])
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: '320px 1fr', alignItems: 'start' }}>
      <div className="panel">
        <div className="panel-head"><div className="panel-title">Case Inbox</div><span className="badge muted">{queue.length}</span></div>
        <div className="panel-body flush">
          <div className="stream" style={{ maxHeight: 520 }}>
            {queue.map((c) => (
              <div key={c.decisionId} className={`case ${selId === c.decisionId ? 'sel' : ''}`} onClick={() => setSelId(c.decisionId)}>
                <div className="top">
                  <span className="mono" style={{ fontSize: 12 }}>#{shortId(c.decisionId)}</span>
                  <span className={`badge ${c.decision}`}>{c.decision}</span>
                </div>
                <div className="reason">₹{c.txn.amount.toLocaleString('en-IN')} · {c.reasons[0]}</div>
              </div>
            ))}
            {queue.length === 0 && <div className="empty">No open cases.</div>}
          </div>
        </div>
      </div>

      <div className="panel" style={{ minHeight: 560, display: 'flex', flexDirection: 'column' }}>
        <div className="panel-head">
          <div className="panel-title"><Bot size={14} className="" /> Fraud Copilot</div>
          {rec && <span className="badge muted">#{shortId(rec.decisionId)} · {rec.modelVersion}</span>}
        </div>

        {!rec && (
          <div className="empty" style={{ margin: 'auto', maxWidth: 340 }}>
            <Shield size={28} className="" />
            <p style={{ marginTop: 12 }}>Select a case from the inbox. The copilot grounds every answer in the stored SHAP record, the account graph, and retrieved similar cases — it never invents facts.</p>
          </div>
        )}

        {rec && exp && (
          <>
            <div className="chat" ref={scroller}>
              {msgs.map((m, i) => (
                <div key={i} className={`bubble-row ${m.who}`}>
                  <span className="bubble-av">{m.who === 'bot' ? <Bot size={15} className="" /> : <User size={15} className="" />}</span>
                  <div className={`bubble ${m.who}`}>
                    <div>{m.text}</div>
                    {m.evidence && (
                      <ul className="bubble-evi">
                        {m.evidence.map((e, j) => <li key={j}>{e}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="chat-actions">
              <div className="suggest-row">
                {['Why was this flagged?', 'ring neighbors?', 'similar cases?', 'What should I do?'].map((q) => (
                  <button key={q} className="btn ghost" onClick={() => ask(q)}>{q}</button>
                ))}
              </div>
              <div className="row" style={{ gap: 10 }}>
                <button className="btn danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => label(rec.decisionId, 'confirmed_fraud')}>Confirm fraud</button>
                <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => label(rec.decisionId, 'false_positive')}>Mark false-positive</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export type { DecisionRecord }
