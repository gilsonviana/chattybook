'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { clearPlanDraft, readPlanDraft, requestJson, type PlanDraft } from '../../lib/client'
import type { PlannedTopic } from '../../lib/topic-plan'
import type { Conversation } from '../../lib/types'

interface PlanResult {
  topics: PlannedTopic[]
  forkSummary: string | null
}

export function SubjectPlanner() {
  const router = useRouter()
  const [draft, setDraft] = useState<PlanDraft | null>(null)
  const [plan, setPlan] = useState<PlanResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)

  const generate = useCallback(async (active: PlanDraft, previous: PlanResult | null) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setIsGenerating(true)
    setError('')
    try {
      const result = await requestJson<PlanResult>('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          ...active.config,
          ...(previous ? { previousTopics: previous.topics.map(topic => topic.title), forkSummary: previous.forkSummary } : {}),
        }),
      })
      if (!controller.signal.aborted) setPlan(result)
    } catch (planError) {
      // A failed regeneration keeps the previous valid draft on screen.
      if (!controller.signal.aborted) setError(planError instanceof Error ? planError.message : 'Could not generate a topic plan.')
    } finally {
      if (request.current === controller) {
        request.current = null
        setIsGenerating(false)
      }
    }
  }, [])

  useEffect(() => {
    function start() {
      const saved = readPlanDraft()
      if (!saved) {
        router.replace('/')
        return
      }
      setDraft(saved)
      void generate(saved, null)
    }
    start()
    return () => request.current?.abort()
  }, [generate, router])

  function goBack() {
    request.current?.abort()
    router.push('/')
  }

  async function confirmPlan() {
    if (!draft || !plan || isGenerating || isStarting) return
    setIsStarting(true)
    setError('')
    try {
      const created = await requestJson<Conversation>('/api/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft.config, topics: plan.topics, ...(draft.config.forkedFromId === null ? {} : { forkSummary: plan.forkSummary }) }),
      })
      clearPlanDraft()
      window.sessionStorage.setItem('chattybook:new-conversation', String(created.id))
      router.replace(`/conversation/${created.id}`)
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Could not start the dialogue.')
      setIsStarting(false)
    }
  }

  if (!draft) return <p className="muted" role="status">Loading planner...</p>

  const { config } = draft
  return (
    <section className="panel planner" aria-labelledby="planner-heading">
      <div className="planner-heading">
        <h2 id="planner-heading">Subject planner</h2>
        <p className="planner-subject">{config.subject}</p>
        <p className="muted">
          {[
            `${config.totalTurns} ${config.totalTurns === 1 ? 'turn' : 'turns'}`,
            config.mode === 'qa' ? 'Q&A' : 'Discussion',
            `Agent 1: ${config.model1}${config.persona1 === 'None' ? '' : ` (${config.persona1})`}`,
            `Agent 2: ${config.model2}${config.persona2 === 'None' ? '' : ` (${config.persona2})`}`,
            ...(config.devilsAdvocate ? ["Devil's advocate"] : []),
            ...(draft.forkSource ? [`Fork of ${draft.forkSource.title ?? draft.forkSource.subject}`] : []),
          ].join(' · ')}
        </p>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      {isGenerating && (
        <p className="planner-status" role="status">
          Agent 1 ({config.model1}) is {plan ? 'regenerating' : 'drafting'} {config.totalTurns} {config.totalTurns === 1 ? 'topic' : 'topics'}. Local models can take a while.
        </p>
      )}
      {plan && (
        <ol className="plan-topics" aria-label="Proposed topics" aria-busy={isGenerating}>
          {plan.topics.map((topic, index) => (
            <li key={`${index}-${topic.title}`}>
              <span className="plan-topic-turn">Turn {index + 1}</span>
              <strong>{topic.title}</strong>
              <p>{topic.description}</p>
            </li>
          ))}
        </ol>
      )}
      <div className="planner-actions">
        <button type="button" className="secondary" onClick={goBack} disabled={isStarting}>Back</button>
        <button type="button" className="secondary" onClick={() => void generate(draft, plan)} disabled={isGenerating || isStarting}>
          {isGenerating && plan ? 'Regenerating...' : 'Regenerate'}
        </button>
        <button type="button" onClick={() => void confirmPlan()} disabled={!plan || isGenerating || isStarting}>
          {isStarting ? draft.forkSource && !plan?.forkSummary ? 'Summarizing...' : 'Starting...' : 'Confirm & Start'}
        </button>
      </div>
    </section>
  )
}
