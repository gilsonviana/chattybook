'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AgentSelector } from '@/components/AgentSelector'
import { getOllamaModels, requestJson } from '../../lib/client'
import { isConversationMode, type ConversationMode } from '../../lib/conversation-mode'
import { isPersona, type Persona } from '../../lib/personas'
import { isResponseLength, resolveResponseLength, type ResponseLength } from '../../lib/response-length'
import type { Conversation, ConversationSummary } from '../../lib/types'
import type { OllamaHealth } from '../../lib/ollama'

const MAX_TITLE_LENGTH = 120

function displayTitle(conversation: Pick<ConversationSummary, 'subject' | 'title'>) {
  return conversation.title ?? conversation.subject
}

export default function Home() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<ConversationSummary[]>([])
  const [historyError, setHistoryError] = useState('')
  const [actionError, setActionError] = useState('')
  const [pendingConversationId, setPendingConversationId] = useState<number | null>(null)
  const [forkingConversationId, setForkingConversationId] = useState<number | null>(null)
  const [forkSource, setForkSource] = useState<Pick<ConversationSummary, 'id' | 'subject' | 'title'> | null>(null)
  const subjectInput = useRef<HTMLInputElement>(null)
  const [renameTarget, setRenameTarget] = useState<ConversationSummary | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isSavingRename, setIsSavingRename] = useState(false)
  const renameDialog = useRef<HTMLDialogElement>(null)
  const renameInput = useRef<HTMLInputElement>(null)
  const [health, setHealth] = useState<OllamaHealth | null>(null)
  const [checking, setChecking] = useState(true)
  const [models, setModels] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [turns, setTurns] = useState<number | ''>(5)
  const [model1, setModel1] = useState('')
  const [model2, setModel2] = useState('')
  const [reviewerModel, setReviewerModel] = useState<string | null>(null)
  const [persona1, setPersona1] = useState<Persona>('None')
  const [persona2, setPersona2] = useState<Persona>('None')
  const [mode, setMode] = useState<ConversationMode>('qa')
  const [responseLength, setResponseLength] = useState<ResponseLength>('medium')
  const [devilsAdvocate, setDevilsAdvocate] = useState(false)

  const refreshOllama = useCallback(() => {
    return requestJson<OllamaHealth>('/api/ollama/health').then(async status => {
      setHealth(status)
      const available = await getOllamaModels()
      setModels(available)
      setModel1(current => available.includes(current) ? current : available[0] || '')
      setModel2(current => available.includes(current) ? current : available[1] || available[0] || '')
      setReviewerModel(current => current && available.includes(current) ? current : null)
      return available
    }).catch(error => {
      setHealth(null)
      setModels([])
      setError(error instanceof Error ? error.message : 'Could not connect to Ollama.')
      return null
    }).finally(() => {
      setChecking(false)
    })
  }, [])

  useEffect(() => {
    function restoreSettings() {
      try {
        const saved: unknown = JSON.parse(window.localStorage.getItem('chattybook:settings') ?? 'null')
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return
        const settings = saved as Record<string, unknown>
        if (typeof settings.turns === 'number' && Number.isInteger(settings.turns) && settings.turns >= 1 && settings.turns <= 100) setTurns(settings.turns)
        if (typeof settings.model1 === 'string') setModel1(settings.model1)
        if (typeof settings.model2 === 'string') setModel2(settings.model2)
        if (settings.reviewerModel === null || typeof settings.reviewerModel === 'string') setReviewerModel(settings.reviewerModel)
        if (isPersona(settings.persona1)) setPersona1(settings.persona1)
        if (isPersona(settings.persona2)) setPersona2(settings.persona2)
        const restoredMode = isConversationMode(settings.mode) ? settings.mode : 'qa'
        setMode(restoredMode)
        if (isResponseLength(settings.responseLength)) setResponseLength(resolveResponseLength(restoredMode, settings.responseLength))
        if (typeof settings.devilsAdvocate === 'boolean') setDevilsAdvocate(settings.devilsAdvocate)
      } catch {
        return
      }
    }
    restoreSettings()
    const forkId = Number(window.sessionStorage.getItem('chattybook:fork'))
    window.sessionStorage.removeItem('chattybook:fork')
    void refreshOllama().then(available => {
      if (!Number.isSafeInteger(forkId) || forkId < 1) return
      void forkConversation(forkId, available ?? []).catch(error => {
        setError(error instanceof Error ? error.message : 'Could not fork the conversation.')
      })
    })
  }, [refreshOllama])

  useEffect(() => {
    if (checking) return
    try {
      window.localStorage.setItem('chattybook:settings', JSON.stringify({
        turns: typeof turns === 'number' && Number.isInteger(turns) && turns >= 1 && turns <= 100 ? turns : 5,
        model1, model2, reviewerModel, persona1, persona2, mode, responseLength, devilsAdvocate,
      }))
    } catch {
      return
    }
  }, [checking, turns, model1, model2, reviewerModel, persona1, persona2, mode, responseLength, devilsAdvocate])

  useEffect(() => {
    let mounted = true
    void requestJson<ConversationSummary[]>('/api/conversation').then(conversations => {
      if (mounted) setHistory(conversations)
    }).catch(error => {
      if (mounted) setHistoryError(error instanceof Error ? error.message : 'Could not load conversation history.')
    })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!renameTarget) return
    const dialog = renameDialog.current
    if (dialog && !dialog.open) dialog.showModal()
    renameInput.current?.focus()
    renameInput.current?.select()
  }, [renameTarget])

  async function startConversation() {
    if (forkingConversationId !== null || !subject.trim() || !model1 || !model2 || !validTurns || !health?.running) return
    setIsLoading(true)
    setError('')
    try {
      const active = await requestJson<Conversation>('/api/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, model1, model2, reviewerModel: mode === 'qa' ? reviewerModel : null, persona1, persona2, mode, responseLength, totalTurns: turns, devilsAdvocate, forkedFromId: forkSource?.id ?? null }),
      })
      window.sessionStorage.setItem('chattybook:new-conversation', String(active.id))
      router.push(`/conversation/${active.id}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not start the dialogue.')
    } finally {
      setIsLoading(false)
    }
  }

  async function forkConversation(conversationId: number, availableModels: string[]) {
    setForkingConversationId(conversationId)
    try {
      const saved = await requestJson<Conversation>(`/api/conversation/${conversationId}`)
      const missingModels = [...new Set([saved.model1, saved.model2, ...(saved.reviewerModel ? [saved.reviewerModel] : [])])]
        .filter(model => !availableModels.includes(model))
      if (missingModels.length) {
        throw new Error(`Cannot fork: these models are unavailable locally: ${missingModels.join(', ')}. Install them and refresh models first.`)
      }
      setSubject(saved.subject)
      setTurns(saved.totalTurns)
      setModel1(saved.model1)
      setModel2(saved.model2)
      setReviewerModel(saved.reviewerModel)
      setPersona1(isPersona(saved.persona1) ? saved.persona1 : 'None')
      setPersona2(isPersona(saved.persona2) ? saved.persona2 : 'None')
      setMode(saved.mode)
      setResponseLength(resolveResponseLength(saved.mode, saved.responseLength))
      setDevilsAdvocate(saved.devilsAdvocate)
      setForkSource({ id: saved.id, subject: saved.subject, title: saved.title })
      setError('')
      subjectInput.current?.focus()
      subjectInput.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } finally {
      setForkingConversationId(null)
    }
  }

  async function forkFromHistory(conversation: ConversationSummary, trigger: HTMLButtonElement) {
    if (isLoading || checking || pendingConversationId !== null || forkingConversationId !== null) return
    setActionError('')
    trigger.closest('details')?.removeAttribute('open')
    try {
      await forkConversation(conversation.id, models)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not fork the conversation.')
    }
  }

  async function manageConversation(conversation: ConversationSummary) {
    if (pendingConversationId !== null) return
    const cancelling = conversation.status === 'generating'
    if (!cancelling && !window.confirm(`Delete "${displayTitle(conversation)}" and all its messages? This cannot be undone.`)) return

    setActionError('')
    setPendingConversationId(conversation.id)
    try {
      await requestJson<{ success: boolean }>(`/api/conversation/${conversation.id}`, { method: cancelling ? 'PATCH' : 'DELETE' })
      setHistory(current => cancelling
        ? current.map(item => item.id === conversation.id ? { ...item, status: 'completed' } : item)
        : current.filter(({ id }) => id !== conversation.id))
    } catch (error) {
      setActionError(error instanceof Error ? error.message : `Could not ${cancelling ? 'cancel' : 'delete'} the conversation.`)
    } finally {
      setPendingConversationId(null)
    }
  }

  function openRename(conversation: ConversationSummary, trigger: HTMLButtonElement) {
    if (conversation.status !== 'completed' || pendingConversationId !== null) return
    trigger.closest('details')?.removeAttribute('open')
    setActionError('')
    setRenameTarget(conversation)
    setRenameValue(displayTitle(conversation))
  }

  async function saveRename() {
    const conversation = renameTarget
    const title = renameValue.trim()
    if (!conversation || !title || title.length > MAX_TITLE_LENGTH || isSavingRename) return

    setIsSavingRename(true)
    setActionError('')
    try {
      await requestJson<{ success: boolean; title: string }>(`/api/conversation/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      setHistory(current => current.map(item => item.id === conversation.id ? { ...item, title } : item))
      renameDialog.current?.close()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not rename the conversation.')
    } finally {
      setIsSavingRename(false)
    }
  }

  const validTurns = typeof turns === 'number' && Number.isInteger(turns) && turns >= 1 && turns <= 100

  return (
    <main className="app">
      <header className="page-header">
        <p className="eyebrow">LOCAL MODELS. REAL CONVERSATIONS.</p>
        <h1>ChattyBook</h1>
        <p>Two AI agents explore a subject, one response at a time.</p>
      </header>

      <section className="connection panel" aria-label="Ollama connection">
        <div role="status">
          <strong>{checking ? 'Checking Ollama...' : health?.running ? `Ollama connected (${health.version})` : 'Ollama unavailable'}</strong>
          <p className="muted">{models.length} local models available. No cloud models are used.</p>
        </div>
        <button className="secondary" onClick={() => { setChecking(true); setError(''); void refreshOllama() }} disabled={checking || isLoading}>Refresh models</button>
      </section>
      {error && <div className="error" role="alert">{error}</div>}
      {!checking && health?.running && models.length === 0 && (
        <p className="error" role="alert">No local models found. Install one with <code>ollama pull qwen3.5:4b</code>, then refresh models.</p>
      )}

      <div className="home-layout">
        <form className="panel setup" onSubmit={event => { event.preventDefault(); void startConversation() }}>
          {forkSource && (
            <div className="fork-banner" role="status">
              <p>Forking <strong>{displayTitle(forkSource)}</strong>. Adjust the models and settings, then start.</p>
              <button type="button" className="secondary" onClick={() => setForkSource(null)} disabled={isLoading}>Clear</button>
            </div>
          )}
          <div className="subject-row">
            <label>
              Discussion subject
              <input ref={subjectInput} value={subject} onChange={event => setSubject(event.target.value)} placeholder="e.g., Can AI make people more creative?" required disabled={isLoading} />
            </label>
            <button type="submit" disabled={isLoading || forkingConversationId !== null || checking || !health?.running || !models.length || !model1 || !model2 || !subject.trim() || !validTurns}>
              {isLoading ? 'Starting...' : 'Start'}
            </button>
          </div>
          <div className="dialogue-options">
            <label>
              Number of turns
              <input className="turns-input" type="number" min={1} max={100} value={turns} onChange={event => setTurns(event.target.value === '' ? '' : Number(event.target.value))} required disabled={isLoading} />
            </label>
            <div className="dialogue-toggles">
              <button
                type="button"
                className="mode-toggle"
                role="switch"
                aria-checked={mode === 'qa'}
                onClick={() => {
                  const nextMode = mode === 'qa' ? 'discussion' : 'qa'
                  setMode(nextMode)
                  setResponseLength(current => resolveResponseLength(nextMode, current))
                }}
                disabled={isLoading}
              >
                <span className="mode-toggle-track" aria-hidden="true"><span className="mode-toggle-thumb" /></span>
                <span>Q&amp;A mode</span>
                <span className="mode-toggle-state" aria-hidden="true">{mode === 'qa' ? 'On' : 'Off'}</span>
              </button>
              <button
                type="button"
                className="mode-toggle"
                role="switch"
                aria-checked={devilsAdvocate}
                title="Agent 1 questions Agent 2's responses and tries to refute them."
                onClick={() => setDevilsAdvocate(current => !current)}
                disabled={isLoading}
              >
                <span className="mode-toggle-track" aria-hidden="true"><span className="mode-toggle-thumb" /></span>
                <span>Devil&apos;s advocate</span>
                <span className="mode-toggle-state" aria-hidden="true">{devilsAdvocate ? 'On' : 'Off'}</span>
              </button>
            </div>
          </div>
          <p className="muted">One turn includes a response from each agent. Default: 5 turns (10 responses).</p>
          <AgentSelector model1={model1} model2={model2} persona1={persona1} persona2={persona2} models={models} onChange={(firstModel, secondModel, firstPersona, secondPersona) => { setModel1(firstModel); setModel2(secondModel); setPersona1(firstPersona); setPersona2(secondPersona) }} disabled={isLoading || checking || !models.length} />
          <p className="muted">Each agent can use a different local model and persona.</p>
          {mode === 'qa' && (
            <label>
              Review model
              <select value={reviewerModel ?? ''} onChange={event => setReviewerModel(event.target.value || null)} disabled={isLoading || checking || !models.length}>
                <option value="">Use Agent 1 model{model1 ? ` (${model1})` : ''}</option>
                {models.map(model => <option key={model} value={model}>{model}</option>)}
              </select>
            </label>
          )}
          <label>
            Response length
            <select value={responseLength} onChange={event => setResponseLength(event.target.value as ResponseLength)} disabled={isLoading}>
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              {mode === 'discussion' && <option value="long">Long</option>}
            </select>
          </label>
        </form>

        <aside className="history" aria-labelledby="history-heading">
          <div className="history-heading">
            <h2 id="history-heading">Previous conversations</h2>
            <span className="muted">{history.length}</span>
          </div>
          {historyError && <p className="error" role="alert">{historyError}</p>}
          {actionError && <p className="error" role="alert">{actionError}</p>}
          {!historyError && history.length === 0 && <p className="muted">No saved conversations yet.</p>}
          {history.length > 0 && (
            <ul className="history-list">
              {history.map(conversation => (
                <li className="history-item" key={conversation.id}>
                  <Link href={`/conversation/${conversation.id}`}>
                    <span className="history-subject">{displayTitle(conversation)}</span>
                    <span className="history-meta">
                      {[
                        ...(conversation.status === 'generating' ? ['Generating'] : []),
                        ...[conversation.persona1, conversation.persona2].filter(persona => persona !== 'None'),
                        ...(conversation.devilsAdvocate ? ["Devil's advocate"] : []),
                        ...(conversation.reviewerModel ? [`Reviewer: ${conversation.reviewerModel}`] : []),
                        conversation.responseLength.charAt(0).toUpperCase() + conversation.responseLength.slice(1),
                      ].join(' · ')}
                    </span>
                  </Link>
                  <details className="history-menu">
                    <summary aria-label={`Actions for ${displayTitle(conversation)}`} title="Conversation actions">⋮</summary>
                    <div className="history-menu-actions">
                      <button
                        type="button"
                        className="history-menu-action"
                        disabled={isLoading || checking || pendingConversationId !== null || forkingConversationId !== null}
                        onClick={event => { void forkFromHistory(conversation, event.currentTarget) }}
                      >
                        {forkingConversationId === conversation.id ? 'Forking...' : 'Fork'}
                      </button>
                      {conversation.status === 'completed' && (
                        <button
                          type="button"
                          className="history-menu-action"
                          disabled={pendingConversationId !== null || forkingConversationId !== null}
                          onClick={event => openRename(conversation, event.currentTarget)}
                        >
                          Rename
                        </button>
                      )}
                      <button
                        type="button"
                        className="history-menu-action history-menu-delete"
                        disabled={pendingConversationId !== null || forkingConversationId !== null}
                        onClick={() => { void manageConversation(conversation) }}
                      >
                        {conversation.status === 'generating'
                          ? pendingConversationId === conversation.id ? 'Cancelling...' : 'Cancel'
                          : pendingConversationId === conversation.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
      {renameTarget && (
        <dialog
          className="rename-dialog"
          ref={renameDialog}
          aria-labelledby="rename-dialog-title"
          onCancel={event => { if (isSavingRename) event.preventDefault() }}
          onClose={() => setRenameTarget(null)}
        >
          <form onSubmit={event => { event.preventDefault(); void saveRename() }}>
            <h2 id="rename-dialog-title">Rename conversation</h2>
            {actionError && <p className="error" role="alert">{actionError}</p>}
            <label htmlFor="rename-conversation-title">Conversation title</label>
            <input
              id="rename-conversation-title"
              ref={renameInput}
              type="text"
              value={renameValue}
              maxLength={MAX_TITLE_LENGTH}
              autoComplete="off"
              disabled={isSavingRename}
              onChange={event => setRenameValue(event.target.value)}
            />
            <div className="rename-dialog-actions">
              <button type="button" className="secondary" disabled={isSavingRename} onClick={() => renameDialog.current?.close()}>Cancel</button>
              <button type="submit" disabled={isSavingRename || !renameValue.trim() || renameValue.trim().length > MAX_TITLE_LENGTH}>
                {isSavingRename ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </main>
  )
}
