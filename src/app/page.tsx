'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EllipsisVertical } from 'lucide-react'
import { AgentSelector } from '@/components/AgentSelector'
import { getOllamaModels, readPlanDraft, requestJson, savePlanDraft } from '../../lib/client'
import { isConversationMode, type ConversationMode } from '../../lib/conversation-mode'
import { isPersona, type Persona } from '../../lib/personas'
import { isResponseLength, resolveResponseLength, type ResponseLength } from '../../lib/response-length'
import type { Conversation, ConversationSummary } from '../../lib/types'
import type { OllamaHealth } from '../../lib/ollama'

const MAX_TITLE_LENGTH = 120

function displayTitle(conversation: Pick<ConversationSummary, 'subject' | 'title'>) {
  return conversation.title ?? conversation.subject
}

const MODE_HINTS: Record<ConversationMode, string> = {
  discussion: 'Both agents debate each topic and build on earlier arguments.',
  qa: 'Agent 1 asks one question per turn; Agent 2 answers it.',
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
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null)
  const deleteDialog = useRef<HTMLDialogElement>(null)
  const deleteCancel = useRef<HTMLButtonElement>(null)
  const homeLayoutRef = useRef<HTMLDivElement>(null)
  const setupFormRef = useRef<HTMLFormElement>(null)
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
  const [devilsAdvocate, setDevilsAdvocate] = useState(false)

  const refreshOllama = useCallback(() => {
    return requestJson<OllamaHealth>('/api/ollama/health').then(async status => {
      setHealth(status)
      const available = await getOllamaModels()
      setModels(available)
      setModel1(current => available.includes(current) ? current : available[0] || '')
      setModel2(current => available.includes(current) ? current : available[1] || available[0] || '')
      return available
    }).catch(() => {
      setHealth(null)
      setModels([])
      return null
    }).finally(() => {
      setChecking(false)
    })
  }, [])

  useEffect(() => {
    const layout = homeLayoutRef.current
    const setupForm = setupFormRef.current
    if (!layout || !setupForm) return

    const updateHistoryHeight = () => {
      layout.style.setProperty('--setup-height', `${setupForm.getBoundingClientRect().height}px`)
    }
    const observer = new ResizeObserver(updateHistoryHeight)
    updateHistoryHeight()
    observer.observe(setupForm)
    return () => observer.disconnect()
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
        if (isPersona(settings.persona1)) setPersona1(settings.persona1)
        if (isPersona(settings.persona2)) setPersona2(settings.persona2)
        const restoredMode = isConversationMode(settings.mode) ? settings.mode : 'qa'
        setMode(restoredMode)
        if (isResponseLength(settings.responseLength)) setResponseLength(resolveResponseLength(restoredMode, settings.responseLength))
        if (restoredMode === 'discussion' && typeof settings.devilsAdvocate === 'boolean') setDevilsAdvocate(settings.devilsAdvocate)
      } catch {
        return
      }
    }
    restoreSettings()
    // Returning from the planner restores the exact draft, including subject and fork source.
    function restoreDraft() {
      const draft = readPlanDraft()
      if (!draft) return
      const { config } = draft
      setSubject(config.subject)
      setTurns(config.totalTurns)
      setModel1(config.model1)
      setModel2(config.model2)
      setPersona1(config.persona1)
      setPersona2(config.persona2)
      setMode(config.mode)
      setResponseLength(resolveResponseLength(config.mode, config.responseLength))
      setDevilsAdvocate(config.mode === 'discussion' && config.devilsAdvocate)
      setForkSource(draft.forkSource)
    }
    restoreDraft()
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
        model1, model2, persona1, persona2, mode, responseLength, devilsAdvocate,
      }))
    } catch {
      return
    }
  }, [checking, turns, model1, model2, persona1, persona2, mode, responseLength, devilsAdvocate])

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

  useEffect(() => {
    if (!deleteTarget) return
    const dialog = deleteDialog.current
    if (dialog && !dialog.open) dialog.showModal()
    deleteCancel.current?.focus()
  }, [deleteTarget])

  function retryOllama() {
    setChecking(true)
    void refreshOllama()
  }

  function changeMode(nextMode: ConversationMode) {
    setMode(nextMode)
    setResponseLength(current => resolveResponseLength(nextMode, current))
    if (nextMode === 'qa') setDevilsAdvocate(false)
  }

  function startConversation() {
    if (forkingConversationId !== null || !subject.trim() || !model1 || !model2 || !validTurns || !health?.running) return
    setIsLoading(true)
    setError('')
    try {
      savePlanDraft({
        config: { subject: subject.trim(), model1, model2, persona1, persona2, mode, responseLength, totalTurns: turns, devilsAdvocate: devilsAdvocate && mode === 'discussion', forkedFromId: forkSource?.id ?? null },
        forkSource,
      })
      router.push('/plan')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not open the subject planner.')
      setIsLoading(false)
    }
  }

  async function forkConversation(conversationId: number, availableModels: string[]) {
    setForkingConversationId(conversationId)
    try {
      const saved = await requestJson<Conversation>(`/api/conversation/${conversationId}`)
      const missingModels = [...new Set([saved.model1, saved.model2])]
        .filter(model => !availableModels.includes(model))
      if (missingModels.length) {
        throw new Error(`Cannot fork: these models are unavailable locally: ${missingModels.join(', ')}. Install them and refresh models first.`)
      }
      setSubject(saved.subject)
      setTurns(saved.totalTurns)
      setModel1(saved.model1)
      setModel2(saved.model2)
      setPersona1(isPersona(saved.persona1) ? saved.persona1 : 'None')
      setPersona2(isPersona(saved.persona2) ? saved.persona2 : 'None')
      setMode(saved.mode)
      setResponseLength(resolveResponseLength(saved.mode, saved.responseLength))
      setDevilsAdvocate(saved.mode === 'discussion' && saved.devilsAdvocate)
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
    if (pendingConversationId !== null) return false
    const cancelling = conversation.status === 'generating'

    setActionError('')
    setPendingConversationId(conversation.id)
    try {
      await requestJson<{ success: boolean }>(`/api/conversation/${conversation.id}`, { method: cancelling ? 'PATCH' : 'DELETE' })
      setHistory(current => cancelling
        ? current.map(item => item.id === conversation.id ? { ...item, status: 'completed' } : item)
        : current.filter(({ id }) => id !== conversation.id))
      return true
    } catch (error) {
      setActionError(error instanceof Error ? error.message : `Could not ${cancelling ? 'cancel' : 'delete'} the conversation.`)
      return false
    } finally {
      setPendingConversationId(null)
    }
  }

  function openDelete(conversation: ConversationSummary, trigger: HTMLButtonElement) {
    trigger.closest('details')?.removeAttribute('open')
    if (conversation.status === 'generating') {
      void manageConversation(conversation)
      return
    }
    setActionError('')
    setDeleteTarget(conversation)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    if (await manageConversation(deleteTarget)) deleteDialog.current?.close()
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
  const blockReason = checking ? 'Checking the Ollama connection...'
    : !health?.running ? 'Start Ollama to continue.'
      : !models.length ? 'Install a local model to continue.'
        : !subject.trim() ? 'Enter a subject to continue.'
          : !validTurns ? 'Choose between 1 and 100 turns.' : ''
  const connectionState = checking ? 'checking' : health?.running ? 'connected' : 'offline'

  return (
    <main className="app home-page">
      <section className="connection" aria-label="Ollama connection">
        <span className={`connection-indicator is-${connectionState}`} aria-hidden="true" />
        <span className="connection-label" role="status">
          {connectionState === 'checking' ? 'Checking Ollama...'
            : connectionState === 'connected' ? <>Ollama connected{health?.version ? ` · v${health.version}` : ''} · {models.length} {models.length === 1 ? 'model' : 'models'}</>
              : <>Ollama is not running. Start it with <code>ollama serve</code>.</>}
        </span>
        {!checking && (
          <button type="button" className="secondary compact" onClick={retryOllama}>
            {health?.running ? 'Refresh models' : 'Retry'}
          </button>
        )}
      </section>
      {error && <div className="error" role="alert">{error}</div>}
      {!checking && health?.running && models.length === 0 && (
        <p className="error" role="alert">No local models found. Install one with <code>ollama pull qwen3.5:4b</code>, then select <strong>Refresh models</strong>.</p>
      )}

      <div className="home-layout" ref={homeLayoutRef}>
        <form ref={setupFormRef} className="panel setup" onSubmit={event => { event.preventDefault(); startConversation() }}>
          {forkSource && (
            <div className="fork-banner" role="status">
              <p>Forking <strong>{displayTitle(forkSource)}</strong>. Adjust the models and settings, then plan the topics. Agent 1&apos;s model first summarizes its key points so the new dialogue avoids repeating them.</p>
              <button type="button" className="secondary" onClick={() => setForkSource(null)} disabled={isLoading}>Clear</button>
            </div>
          )}
          <div className="setup-heading">
            <h1>New dialogue</h1>
            <p className="muted">Choose a subject and two agents, then review the topic plan before the dialogue starts.</p>
          </div>
          <label className="subject-field">
            Subject
            <input ref={subjectInput} value={subject} onChange={event => setSubject(event.target.value)} placeholder="e.g., Can AI make people more creative?" required disabled={isLoading} />
          </label>
          <fieldset className="setup-group">
            <legend>Agents</legend>
            <AgentSelector model1={model1} model2={model2} persona1={persona1} persona2={persona2} models={models} onChange={(firstModel, secondModel, firstPersona, secondPersona) => { setModel1(firstModel); setModel2(secondModel); setPersona1(firstPersona); setPersona2(secondPersona) }} disabled={isLoading || checking || !models.length} />
          </fieldset>
          <fieldset className="setup-group">
            <legend>Dialogue</legend>
            <div className="dialogue-options">
              <div className="field">
                <span className="field-label" id="mode-label">Mode</span>
                <div className="segmented" role="radiogroup" aria-labelledby="mode-label" aria-describedby="mode-hint">
                  {(['discussion', 'qa'] as const).map(value => (
                    <label key={value} className="segmented-option">
                      <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => changeMode(value)} disabled={isLoading} />
                      <span>{value === 'qa' ? 'Q&A' : 'Discussion'}</span>
                    </label>
                  ))}
                </div>
                <p className="field-hint" id="mode-hint">{MODE_HINTS[mode]}</p>
              </div>
              <div className="field">
                <span className="field-label" id="devils-advocate-label">Devil&apos;s advocate</span>
                <button
                  type="button"
                  className="mode-toggle"
                  role="switch"
                  aria-labelledby="devils-advocate-label"
                  aria-describedby="devils-advocate-hint"
                  aria-checked={devilsAdvocate && mode !== 'qa'}
                  onClick={() => setDevilsAdvocate(current => !current)}
                  disabled={isLoading || mode === 'qa'}
                >
                  <span className="mode-toggle-track" aria-hidden="true"><span className="mode-toggle-thumb" /></span>
                  <span className="mode-toggle-state" aria-hidden="true">{devilsAdvocate && mode !== 'qa' ? 'On' : 'Off'}</span>
                </button>
                <p className="field-hint" id="devils-advocate-hint">
                  {mode === 'qa' ? 'Available in Discussion mode.' : "Agent 1 challenges Agent 2's claims and tries to refute them."}
                </p>
              </div>
            </div>
            <div className="length-turns">
              <label>
                Response length
                <select value={responseLength} onChange={event => setResponseLength(event.target.value as ResponseLength)} disabled={isLoading}>
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  {mode === 'discussion' && <option value="long">Long</option>}
                </select>
              </label>
              <label>
                Number of turns
                <input type="number" min={1} max={100} value={turns} onChange={event => setTurns(event.target.value === '' ? '' : Number(event.target.value))} required disabled={isLoading} aria-describedby="turns-hint" />
                <span className="field-hint" id="turns-hint">
                  {validTurns ? `${turns * 2} responses, one from each agent per turn.` : 'Enter 1 to 100 turns.'}
                </span>
              </label>
            </div>
          </fieldset>
          <div className="setup-actions">
            {blockReason && <p className="muted">{blockReason}</p>}
            <button type="submit" disabled={isLoading || forkingConversationId !== null || checking || !health?.running || !models.length || !model1 || !model2 || !subject.trim() || !validTurns}>
              {isLoading ? 'Opening...' : 'Plan topics'}
            </button>
          </div>
        </form>

        <aside className="history" aria-labelledby="history-heading">
          <div className="history-heading">
            <h2 id="history-heading">Recents</h2>
            <span className="muted">{history.length}</span>
          </div>
          <div className="history-content">
            {historyError && <p className="error" role="alert">{historyError}</p>}
            {actionError && <p className="error" role="alert">{actionError}</p>}
            {!historyError && history.length === 0 && (
              <div className="history-empty">
                <p><strong>No conversations yet</strong></p>
                <p className="muted">Plan topics for a subject and your dialogues will be listed here.</p>
              </div>
            )}
            {history.length > 0 && (
              <ul className="history-list">
                {history.map(conversation => (
                  <li className="history-item" key={conversation.id}>
                    <Link href={`/conversation/${conversation.id}`}>
                      <span className="history-subject">{displayTitle(conversation)}</span>
                      <span className="history-meta">
                        {[
                          new Date(conversation.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                          `${conversation.messageCount} ${conversation.messageCount === 1 ? 'response' : 'responses'}`,
                          ...[conversation.persona1, conversation.persona2].filter(persona => persona !== 'None'),
                        ].join(' · ')}
                      </span>
                      {(conversation.status === 'generating' || conversation.forkedFromId !== null || conversation.devilsAdvocate) && (
                        <span className="history-tags">
                          {conversation.status === 'generating' && <span className="tag tag-accent">Generating</span>}
                          {conversation.forkedFromId !== null && <span className="tag">Forked</span>}
                          {conversation.devilsAdvocate && <span className="tag">Devil&apos;s advocate</span>}
                        </span>
                      )}
                    </Link>
                    <details className="history-menu">
                      <summary aria-label={`Actions for ${displayTitle(conversation)}`} title="Conversation actions">
                        <EllipsisVertical size={18} aria-hidden="true" />
                      </summary>
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
                          onClick={event => openDelete(conversation, event.currentTarget)}
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
          </div>
        </aside>
      </div>
      {renameTarget && (
        <dialog
          className="app-dialog"
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
            <div className="dialog-actions">
              <button type="button" className="secondary" disabled={isSavingRename} onClick={() => renameDialog.current?.close()}>Cancel</button>
              <button type="submit" disabled={isSavingRename || !renameValue.trim() || renameValue.trim().length > MAX_TITLE_LENGTH}>
                {isSavingRename ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </dialog>
      )}
      {deleteTarget && (
        <dialog
          className="app-dialog"
          ref={deleteDialog}
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-description"
          onCancel={event => { if (pendingConversationId !== null) event.preventDefault() }}
          onClose={() => setDeleteTarget(null)}
        >
          <form onSubmit={event => { event.preventDefault(); void confirmDelete() }}>
            <h2 id="delete-dialog-title">Delete conversation?</h2>
            {actionError && <p className="error" role="alert">{actionError}</p>}
            <p id="delete-dialog-description">
              <strong>{displayTitle(deleteTarget)}</strong> and all its messages will be permanently deleted.
            </p>
            <div className="dialog-actions">
              <button type="button" className="secondary" ref={deleteCancel} disabled={pendingConversationId !== null} onClick={() => deleteDialog.current?.close()}>Cancel</button>
              <button type="submit" className="danger" disabled={pendingConversationId !== null}>
                {pendingConversationId === deleteTarget.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </main>
  )
}
