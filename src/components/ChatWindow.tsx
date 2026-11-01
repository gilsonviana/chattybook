'use client'

import { useState, type RefObject } from 'react'
import { AlertCircle, Check, Copy } from 'lucide-react'
import { getPersonaLabel } from '../../lib/personas'
import type { ConversationTopic, Message } from '../../lib/types'

interface ChatWindowProps {
  title: string
  messages: Message[]
  topics: ConversationTopic[]
  isLoading: boolean
  totalTurns: number
  persona1: string
  persona2: string
  model1: string
  model2: string
  devilsAdvocate: boolean
  forkedFromId: number | null
  forkSummary: string | null
  forkCount: number
  endRef: RefObject<HTMLDivElement | null>
}

export function ChatWindow({ title, messages, topics, isLoading, totalTurns, persona1, persona2, model1, model2, forkSummary, endRef }: ChatWindowProps) {
  const [copyStatus, setCopyStatus] = useState<{ messageId: number; status: 'copied' | 'error' } | null>(null)

  async function copyResponse(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopyStatus({ messageId: message.id, status: 'copied' })
    } catch {
      setCopyStatus({ messageId: message.id, status: 'error' })
    }
  }

  return (
    <section className="panel chat-window" aria-label={`Agent dialogue: ${title}`} role="log" aria-live="polite">
      {forkSummary && (
        <details className="fork-summary">
          <summary>Key points carried over from the forked conversation</summary>
          <p>{forkSummary}</p>
        </details>
      )}
      {messages.length === 0 && <p className="muted conversation-empty">The agents&apos; responses will appear here.</p>}
      {messages.map(message => (
        <article key={message.id} className={`message ${message.speaker}`}>
          <h3>Agent {message.speaker === 'agent1' ? '1' : '2'} ({getPersonaLabel(message.speaker === 'agent1' ? persona1 : persona2)}) - {message.speaker === 'agent1' ? model1 : model2} <span>Turn {message.turnNumber} of {totalTurns}</span></h3>
          {message.speaker === 'agent1' && topics[message.turnNumber - 1] && (
            <p className="message-topic">Topic: {topics[message.turnNumber - 1].title}</p>
          )}
          <p>{message.content}</p>
          <button
            type="button"
            className="message-copy"
            aria-label={copyStatus?.messageId === message.id
              ? copyStatus.status === 'copied' ? 'Response copied' : 'Copy failed'
              : `Copy response from Agent ${message.speaker === 'agent1' ? '1' : '2'}`}
            title={copyStatus?.messageId === message.id
              ? copyStatus.status === 'copied' ? 'Copied' : 'Copy failed'
              : 'Copy response'}
            onClick={() => void copyResponse(message)}
          >
            {copyStatus?.messageId === message.id
              ? copyStatus.status === 'copied' ? <Check size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />
              : <Copy size={14} aria-hidden="true" />}
          </button>
        </article>
      ))}
      {isLoading && (() => {
        const speaker = messages.length % 2 === 0 ? 'agent1' : 'agent2'
        const number = speaker === 'agent1' ? '1' : '2'
        const topic = topics[Math.floor(messages.length / 2)]
        return (
          <article className={`message ${speaker} typing`} role="status">
            <h3>Agent {number} ({getPersonaLabel(speaker === 'agent1' ? persona1 : persona2)}) - {speaker === 'agent1' ? model1 : model2}</h3>
            <span className="typing-label">is thinking</span>
            <div className="typing-dots" aria-hidden="true"><span /><span /><span /></div>
            {topic && <p className="typing-hint">Topic: {topic.title}</p>}
            {messages.length === 0 && <p className="typing-hint">Loading a local model can take a moment.</p>}
          </article>
        )
      })()}
      <div ref={endRef} />
    </section>
  )
}
