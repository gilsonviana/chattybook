'use client'

import { useEffect, useRef, useState } from 'react'
import { getOllamaModels, requestJson } from '../../lib/client'
import type { Conversation } from '../../lib/types'

type SavedSummary = Pick<Conversation, 'summary' | 'summaryModel'>

export function ConversationSummary({ conversation, disabled }: { conversation: Conversation; disabled: boolean }) {
  const [saved, setSaved] = useState<SavedSummary>({ summary: conversation.summary, summaryModel: conversation.summaryModel })
  const [model, setModel] = useState(conversation.model1)
  const [models, setModels] = useState<string[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelsError, setModelsError] = useState('')
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const group = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const busy = useRef(false)
  const menuId = `summary-models-${conversation.id}`
  const canSummarize = !disabled && conversation.status === 'completed' && conversation.messages.length > 0 && !isSummarizing && !modelsLoading && models.includes(model)

  useEffect(() => {
    let cancelled = false
    void getOllamaModels().then(available => {
      if (!cancelled) setModels(available)
    }).catch(loadError => {
      if (!cancelled) setModelsError(loadError instanceof Error ? loadError.message : 'Could not load summary models.')
    }).finally(() => {
      if (!cancelled) setModelsLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const selected = menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
    ;(selected ?? menu.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"]'))?.focus()
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !group.current?.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [menuOpen])

  async function refreshModels() {
    setModelsLoading(true)
    setModelsError('')
    try {
      setModels(await getOllamaModels())
    } catch (loadError) {
      setModelsError(loadError instanceof Error ? loadError.message : 'Could not load summary models.')
    } finally {
      setModelsLoading(false)
    }
  }

  async function summarize() {
    if (!canSummarize || busy.current) return
    busy.current = true
    setIsSummarizing(true)
    setError('')
    setMenuOpen(false)
    try {
      setSaved(await requestJson<SavedSummary>(`/api/conversation/${conversation.id}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      }))
    } catch (summaryError) {
      setError(summaryError instanceof Error ? summaryError.message : 'Could not summarize this conversation.')
    } finally {
      busy.current = false
      setIsSummarizing(false)
    }
  }

  return (
    <section className="conversation-summary" aria-label="Conversation summary" aria-busy={isSummarizing}>
      <div className="summary-controls">
        <div
          className="summary-button-group"
          role="group"
          aria-label="Summarize conversation"
          ref={group}
          onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false)
          }}
          onKeyDown={event => {
            if (event.key === 'Escape' && menuOpen) {
              event.preventDefault()
              setMenuOpen(false)
              toggle.current?.focus()
            }
          }}
        >
          <button type="button" className="summary-generate" disabled={!canSummarize} onClick={() => void summarize()}>
            <span>{isSummarizing ? 'Summarizing...' : 'Summarize'}</span>
            <span className="summary-button-model">{model}{model === conversation.model1 ? ' (Agent 1)' : ''}</span>
          </button>
          <button
            type="button"
            className="summary-model-toggle"
            ref={toggle}
            aria-label={`Select summary model: ${model}`}
            title={`Summary model: ${model}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            disabled={isSummarizing || modelsLoading || models.length === 0}
            onClick={() => setMenuOpen(open => !open)}
            onKeyDown={event => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                setMenuOpen(true)
              }
            }}
          >
            <span className="summary-chevron" aria-hidden="true" />
          </button>
          {menuOpen && (
            <div
              id={menuId}
              className="summary-model-menu"
              role="menu"
              aria-label="Summary model"
              ref={menu}
              onKeyDown={event => {
                const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'))
                const current = items.indexOf(document.activeElement as HTMLButtonElement)
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
                  : event.key === 'ArrowDown' ? (current + 1) % items.length
                    : event.key === 'ArrowUp' ? (current - 1 + items.length) % items.length : null
                if (next !== null) {
                  event.preventDefault()
                  items[next]?.focus()
                }
              }}
            >
              {models.map(available => (
                <button
                  key={available}
                  type="button"
                  role="menuitemradio"
                  aria-checked={model === available}
                  tabIndex={-1}
                  onClick={() => {
                    setModel(available)
                    setMenuOpen(false)
                    toggle.current?.focus()
                  }}
                >
                  <span>{available}{available === conversation.model1 && <small>Agent 1 (default)</small>}</span>
                  <span className="summary-selection" aria-hidden="true">{model === available ? '\u2713' : ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {isSummarizing && <p className="muted" role="status">Generating summary...</p>}
        {modelsLoading && <p className="muted" role="status">Loading summary models...</p>}
        {!modelsLoading && (modelsError || !models.includes(model)) && (
          <div className="summary-model-error">
            <p className="muted" role="status">{modelsError || (models.length ? 'The selected model is not installed.' : 'No local models installed.')}</p>
            <button type="button" className="secondary" onClick={() => void refreshModels()}>Refresh models</button>
          </div>
        )}
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <div aria-live="polite" aria-atomic="true">
        {saved.summary && (
          <div className="summary-result">
            <h2>Summary</h2>
            <p className="muted">{saved.summaryModel}</p>
            <ul>
              {saved.summary.split('\n').filter(line => line.trim()).map((line, index) => (
                <li key={index}>{line.replace(/^\s*[-*]\s+/, '').trim()}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
