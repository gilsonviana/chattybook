'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AgentSelector } from '@/components/AgentSelector'
import { getOllamaModels, requestJson } from '../../lib/client'
import type { ConversationMode } from '../../lib/conversation-mode'
import { type Persona } from '../../lib/personas'
import type { ResponseLength } from '../../lib/response-length'
import type { Conversation, ConversationSummary } from '../../lib/types'
import type { OllamaHealth } from '../../lib/ollama'

export default function Home() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<ConversationSummary[]>([])
  const [historyError, setHistoryError] = useState('')
  const [actionError, setActionError] = useState('')
  const [pendingConversationId, setPendingConversationId] = useState<number | null>(null)
  const [health, setHealth] = useState<OllamaHealth | null>(null)
  const [checking, setChecking] = useState(true)
  const [models, setModels] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [turns, setTurns] = useState<number | ''>(5)
  const [model1, setModel1] = useState('')
  const [model2, setModel2] = useState('')
  const [persona1, setPersona1] = useState<Persona>('None')
  const [persona2, setPersona2] = useState<Persona>('None')
  const [mode, setMode] = useState<ConversationMode>('qa')
  const [responseLength, setResponseLength] = useState<ResponseLength>('medium')

  const refreshOllama = useCallback(() => {
    return requestJson<OllamaHealth>('/api/ollama/health').then(async status => {
      setHealth(status)
      const available = await getOllamaModels()
      setModels(available)
      setModel1(current => available.includes(current) ? current : available[0] || '')
      setModel2(current => available.includes(current) ? current : available[1] || available[0] || '')
    }).catch(error => {
      setHealth(null)
      setModels([])
      setError(error instanceof Error ? error.message : 'Could not connect to Ollama.')
    }).finally(() => {
      setChecking(false)
    })
  }, [])

  useEffect(() => { void refreshOllama() }, [refreshOllama])

  useEffect(() => {
    let mounted = true
    void requestJson<ConversationSummary[]>('/api/conversation').then(conversations => {
      if (mounted) setHistory(conversations)
    }).catch(error => {
      if (mounted) setHistoryError(error instanceof Error ? error.message : 'Could not load conversation history.')
    })
    return () => { mounted = false }
  }, [])

  async function startConversation() {
    if (!subject.trim() || !model1 || !model2 || !validTurns || !health?.running) return
    setIsLoading(true)
    setError('')
    try {
      const active = await requestJson<Conversation>('/api/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, model1, model2, persona1, persona2, mode, responseLength, totalTurns: turns }),
      })
      window.sessionStorage.setItem('chattybook:new-conversation', String(active.id))
      router.push(`/conversation/${active.id}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not start the dialogue.')
    } finally {
      setIsLoading(false)
    }
  }

  async function manageConversation(conversation: ConversationSummary) {
    if (pendingConversationId !== null) return
    const cancelling = conversation.status === 'generating'
    if (!cancelling && !window.confirm(`Delete "${conversation.subject}" and all its messages? This cannot be undone.`)) return

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
          <label>
            Discussion subject
            <input value={subject} onChange={event => setSubject(event.target.value)} placeholder="e.g., Can AI make people more creative?" required disabled={isLoading} />
          </label>
          <AgentSelector model1={model1} model2={model2} persona1={persona1} persona2={persona2} models={models} onChange={(firstModel, secondModel, firstPersona, secondPersona) => { setModel1(firstModel); setModel2(secondModel); setPersona1(firstPersona); setPersona2(secondPersona) }} disabled={isLoading || checking || !models.length} />
          <p className="muted">Each agent can use a different local model and persona.</p>
          <button
            type="button"
            className="secondary mode-toggle"
            aria-pressed={mode === 'qa'}
            onClick={() => setMode(current => current === 'qa' ? 'discussion' : 'qa')}
            disabled={isLoading}
          >
            Q&amp;A mode: {mode === 'qa' ? 'On' : 'Off'}
          </button>
          <label>
            Response length
            <select value={responseLength} onChange={event => setResponseLength(event.target.value as ResponseLength)} disabled={isLoading}>
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </label>
          <label>
            Number of turns
            <input className="turns-input" type="number" min={1} max={100} value={turns} onChange={event => setTurns(event.target.value === '' ? '' : Number(event.target.value))} required disabled={isLoading} />
          </label>
          <p className="muted">One turn includes a response from each agent. Default: 5 turns (10 responses).</p>
          <button type="submit" disabled={isLoading || checking || !health?.running || !models.length || !model1 || !model2 || !subject.trim() || !validTurns}>
            {isLoading ? 'Starting...' : 'Start dialogue'}
          </button>
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
                    <span className="history-subject">{conversation.subject}</span>
                    <span className="history-meta">
                      {[
                        ...(conversation.status === 'generating' ? ['Generating'] : []),
                        ...[conversation.persona1, conversation.persona2].filter(persona => persona !== 'None'),
                        conversation.responseLength.charAt(0).toUpperCase() + conversation.responseLength.slice(1),
                      ].join(' · ')}
                    </span>
                  </Link>
                  <details className="history-menu">
                    <summary aria-label={`Actions for ${conversation.subject}`} title="Conversation actions">⋮</summary>
                    <button
                      type="button"
                      className="history-menu-delete"
                      disabled={pendingConversationId !== null}
                      onClick={() => { void manageConversation(conversation) }}
                    >
                      {conversation.status === 'generating'
                        ? pendingConversationId === conversation.id ? 'Cancelling...' : 'Cancel'
                        : pendingConversationId === conversation.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </main>
  )
}
