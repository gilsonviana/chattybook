'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatWindow } from '@/components/ChatWindow'
import { AgentSelector } from '@/components/AgentSelector'
import { getOllamaModels, requestJson } from '../../lib/client'
import type { ConversationMode } from '../../lib/conversation-mode'
import { type Persona } from '../../lib/personas'
import type { ResponseLength } from '../../lib/response-length'
import type { Conversation, Message } from '../../lib/types'
import type { OllamaHealth } from '../../lib/ollama'

export default function Home() {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [health, setHealth] = useState<OllamaHealth | null>(null)
  const [checking, setChecking] = useState(true)
  const [models, setModels] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [turns, setTurns] = useState<number | ''>(5)
  const [model1, setModel1] = useState('')
  const [model2, setModel2] = useState('')
  const [persona1, setPersona1] = useState<Persona>('None')
  const [persona2, setPersona2] = useState<Persona>('None')
  const [mode, setMode] = useState<ConversationMode>('discussion')
  const [responseLength, setResponseLength] = useState<ResponseLength>('medium')
  const busy = useRef(false)

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

  async function generateDialogue(active: Conversation) {
    // Use request-local state, not React state captured before an async update.
    let history = active.messages
    while (history.length < active.totalTurns * 2) {
      const result = await requestJson<{ allMessages: Message[]; completed: boolean }>('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: active.id, expectedMessageCount: history.length }),
      })
      history = result.allMessages
      setMessages(history)
      setConversation({ ...active, messages: history, status: result.completed ? 'completed' : 'active' })
    }
  }

  async function startConversation() {
    if (busy.current || !subject.trim() || !model1 || !model2 || !validTurns || !health?.running) return
    busy.current = true
    setIsLoading(true)
    setError('')
    try {
      const active = await requestJson<Conversation>('/api/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, model1, model2, persona1, persona2, mode, responseLength, totalTurns: turns }),
      })
      setConversation(active)
      setMessages(active.messages)
      await generateDialogue(active)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not start the dialogue.')
    } finally {
      busy.current = false
      setIsLoading(false)
    }
  }

  async function retryConversation() {
    if (busy.current || !conversation) return
    busy.current = true
    setIsLoading(true)
    setError('')
    try {
      // Reconcile persisted messages if the previous response was lost in transit.
      const active = await requestJson<Conversation>(`/api/conversation/${conversation.id}`)
      setConversation(active)
      setMessages(active.messages)
      await generateDialogue(active)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not continue the dialogue.')
    } finally {
      busy.current = false
      setIsLoading(false)
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

      {!conversation ? (
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
      ) : (
        <>
          <ChatWindow subject={conversation.subject} messages={messages} isLoading={isLoading} totalTurns={conversation.totalTurns} persona1={conversation.persona1} persona2={conversation.persona2} />
          <div className="actions">
            {!isLoading && conversation.status !== 'completed' && <button onClick={retryConversation}>Retry / continue dialogue</button>}
            <button className="secondary" disabled={isLoading} onClick={() => { setConversation(null); setMessages([]); setError('') }}>New dialogue</button>
            {conversation.status === 'completed' && <strong role="status">Dialogue completed</strong>}
          </div>
          <p className="muted">Agent 1: {conversation.model1} / {conversation.persona1}; Agent 2: {conversation.model2} / {conversation.persona2}</p>
        </>
      )}
      <footer>Powered by local Ollama models. Conversations are saved on this computer.</footer>
    </main>
  )
}
