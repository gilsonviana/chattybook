'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getOllamaModels } from '../../lib/client'
import type { Message, Topic } from '../../lib/types'

interface TopicSidebarProps {
  topics: Topic[]
  messages: Message[]
  model: string
  appliedModel: string
  refreshingModel: string | null
  defaultModel: string
  isUpdating: boolean
  isGenerating: boolean
  error: string
  onModelChange: (model: string) => void
  onRefresh: () => void
  onKeepCurrent: () => void
  onSelect: (messageId: number) => void
}

export function TopicSidebar({ topics, messages, model, appliedModel, refreshingModel, defaultModel, isUpdating, isGenerating, error, onModelChange, onRefresh, onKeepCurrent, onSelect }: TopicSidebarProps) {
  const [models, setModels] = useState<string[]>([])
  const [modelsError, setModelsError] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getOllamaModels().then(available => {
      if (!cancelled) setModels(available)
    }).catch(loadError => {
      if (!cancelled) setModelsError(loadError instanceof Error ? loadError.message : 'Could not load topic models.')
    })
    return () => { cancelled = true }
  }, [])

  const turns = new Map(messages.map(message => [message.id, message.turnNumber]))

  return (
    <aside className={`topic-sidebar panel${open ? ' is-open' : ''}`} aria-labelledby="topic-sidebar-heading" aria-busy={isUpdating}>
      <button
        type="button"
        className="topic-sidebar-toggle"
        aria-expanded={open}
        aria-controls="topic-sidebar-content"
        onClick={() => setOpen(current => !current)}
      >
        <span>Topics{topics.length ? ` (${topics.length})` : ''}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <div id="topic-sidebar-content" className="topic-sidebar-content">
        <h2 id="topic-sidebar-heading">Topics</h2>
        <label className="topic-model">
          Topic model
          <select value={model} onChange={event => onModelChange(event.target.value)}>
            {!models.includes(model) && <option value={model}>{model}</option>}
            {models.map(available => (
              <option key={available} value={available}>{available}{available === defaultModel ? ' (Agent 1)' : ''}</option>
            ))}
          </select>
        </label>
        {model !== appliedModel && (
          <div className="topic-refresh">
            <p className="muted">Current topics were identified by {appliedModel}. Refreshing replaces them.</p>
            <div className="topic-refresh-actions">
              <button type="button" onClick={onRefresh} disabled={isUpdating || messages.length === 0}>Refresh topics</button>
              <button type="button" className="secondary" onClick={onKeepCurrent}>Keep current</button>
            </div>
          </div>
        )}
        {modelsError && <p className="muted">{modelsError}</p>}
        {topics.length > 0 ? (
          <nav aria-label="Conversation topics">
            <ol className="topic-list">
              {topics.map(topic => (
                <li key={topic.id}>
                  <a
                    href={`#message-${topic.messageId}`}
                    onClick={event => {
                      event.preventDefault()
                      setOpen(false)
                      onSelect(topic.messageId)
                    }}
                  >
                    <span className="topic-title">{topic.title}</span>
                    {turns.has(topic.messageId) && <span className="topic-meta">Turn {turns.get(topic.messageId)}</span>}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : !isUpdating && (
          <p className="muted">{isGenerating ? 'Topics will appear as the agents talk.' : 'No topics were identified for this conversation.'}</p>
        )}
        <div aria-live="polite">
          {isUpdating && <p className="muted topic-status" role="status">{refreshingModel ? `Regenerating topics with ${refreshingModel}...` : 'Identifying topic...'}</p>}
        </div>
        {error && <p className="topic-error" role="alert">{error}</p>}
      </div>
    </aside>
  )
}
