'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { clearPlanDraft, getOllamaModels, readPlanDraft, requestJson, type PlanDraft } from '../../lib/client'
import type { PlannedTopic } from '../../lib/topic-plan'
import type { Conversation } from '../../lib/types'

interface PlanResult {
  topics: PlannedTopic[]
  forkSummary: string | null
  requestedCount: number
  incomplete: string | null
  model: string
}

export function SubjectPlanner() {
  const router = useRouter()
  const [draft, setDraft] = useState<PlanDraft | null>(null)
  const [plan, setPlan] = useState<PlanResult | null>(null)
  const [planModel, setPlanModel] = useState('')
  const [models, setModels] = useState<string[] | null>(null)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)

  const generate = useCallback(async (active: PlanDraft, previous: PlanResult | null, model: string) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setIsGenerating(true)
    setError('')
    try {
      const result = await requestJson<Omit<PlanResult, 'model'>>('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          ...active.config,
          planModel: model,
          ...(previous ? { forkSummary: previous.forkSummary } : {}),
          ...(previous?.topics.length ? { previousTopics: previous.topics.map(topic => topic.title) } : {}),
        }),
      })
      if (!controller.signal.aborted) {
        setPlan({ ...result, model })
        setShowModelPicker(!result.topics.length)
      }
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
      setPlanModel(saved.config.model1)
      void generate(saved, null, saved.config.model1)
    }
    start()
    return () => request.current?.abort()
  }, [generate, router])

  useEffect(() => {
    if (!showModelPicker || models) return
    let active = true
    getOllamaModels()
      .then(list => { if (active) setModels(list) })
      .catch(modelsError => { if (active) setError(modelsError instanceof Error ? modelsError.message : 'Could not load local models.') })
    return () => { active = false }
  }, [showModelPicker, models])

  function goBack() {
    request.current?.abort()
    router.push('/')
  }

  async function confirmPlan() {
    if (!draft || !plan?.topics.length || isGenerating || isStarting) return
    setIsStarting(true)
    setError('')
    try {
      const created = await requestJson<Conversation>('/api/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft.config,
          totalTurns: plan.topics.length,
          topics: plan.topics,
          ...(draft.config.forkedFromId === null ? {} : { forkSummary: plan.forkSummary }),
        }),
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
  const topicCount = plan?.topics.length ?? 0
  const isEmpty = plan !== null && topicCount === 0
  const isPartial = plan !== null && topicCount > 0 && topicCount < plan.requestedCount
  const modelPicker = showModelPicker && (
    <div className="planner-model">
      <label htmlFor="planner-model">Drafting model</label>
      <select
        id="planner-model"
        value={planModel}
        onChange={event => setPlanModel(event.target.value)}
        disabled={!models || isGenerating || isStarting}
      >
        {(models ?? [planModel]).map(model => <option key={model} value={model}>{model}</option>)}
      </select>
      <button type="button" onClick={() => void generate(draft, plan, planModel)} disabled={!models || isGenerating || isStarting}>
        Draft with this model
      </button>
    </div>
  )
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
          {planModel} is {plan ? 'regenerating' : 'drafting'} {config.totalTurns} {config.totalTurns === 1 ? 'topic' : 'topics'}. Local models can take a while.
        </p>
      )}
      {!isGenerating && isEmpty && (
        <div className="planner-notice" role="alert">
          <p><strong>{plan.model} could not draft any topics.</strong> Pick a different model to draft the topics, or go back to the homepage.</p>
          {plan.incomplete && <p className="muted">{plan.incomplete}</p>}
        </div>
      )}
      {!isGenerating && isPartial && (
        <div className="planner-notice" role="status">
          <p><strong>{plan.model} drafted {topicCount} of {plan.requestedCount} topics.</strong> Continue with these {topicCount} {topicCount === 1 ? 'turn' : 'turns'}, regenerate, or try a different model.</p>
          {plan.incomplete && <p className="muted">{plan.incomplete}</p>}
        </div>
      )}
      {modelPicker}
      {plan && topicCount > 0 && (
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
        <button type="button" className="secondary" onClick={goBack} disabled={isStarting}>{isEmpty ? 'Back to homepage' : 'Back'}</button>
        {isPartial && !showModelPicker && (
          <button type="button" className="secondary" onClick={() => setShowModelPicker(true)} disabled={isGenerating || isStarting}>
            Try a different model
          </button>
        )}
        <button type="button" className="secondary" onClick={() => void generate(draft, plan, planModel)} disabled={isGenerating || isStarting}>
          {isGenerating && plan ? 'Regenerating...' : 'Regenerate'}
        </button>
        {!isEmpty && (
          <button type="button" onClick={() => void confirmPlan()} disabled={!plan || isGenerating || isStarting}>
            {isStarting
              ? draft.forkSource && !plan?.forkSummary ? 'Summarizing...' : 'Starting...'
              : isPartial ? `Continue with ${topicCount} ${topicCount === 1 ? 'topic' : 'topics'}` : 'Confirm & Start'}
          </button>
        )}
      </div>
    </section>
  )
}
