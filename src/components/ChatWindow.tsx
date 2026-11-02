'use client'

import { Fragment, useState, type RefObject } from 'react'
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
  forkSummary: string | null
  endRef: RefObject<HTMLDivElement | null>
}

function AgentHeading({ speaker, persona, model }: { speaker: Message['speaker']; persona: string; model: string }) {
  return (
    <h3>
      <span className="message-agent">Agent {speaker === 'agent1' ? '1' : '2'}{persona === 'None' ? '' : ` · ${getPersonaLabel(persona)}`}</span>
      <span className="message-model">{model}</span>
    </h3>
  )
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

  function turnDivider(turn: number) {
    const topic = topics[turn - 1]
    return (
      <p className="turn-divider">
        <span>Turn {turn} of {totalTurns}{topic ? <> · <strong>{topic.title}</strong></> : null}</span>
      </p>
    )
  }

  const pendingSpeaker = messages.length % 2 === 0 ? 'agent1' : 'agent2'
  const pendingTurn = Math.floor(messages.length / 2) + 1

  return (
    <section className="panel chat-window" aria-label={`Agent dialogue: ${title}`} role="log" aria-live="polite">
      {forkSummary && (
        <details className="fork-summary">
          <summary>Key points carried over from the forked conversation</summary>
          <p>{forkSummary}</p>
        </details>
      )}
      {messages.length === 0 && !isLoading && <p className="muted conversation-empty">The agents&apos; responses will appear here.</p>}
      {messages.map((message, index) => (
        <Fragment key={message.id}>
          {(index === 0 || messages[index - 1].turnNumber !== message.turnNumber) && turnDivider(message.turnNumber)}
          <article className={`message ${message.speaker}`}>
            <AgentHeading speaker={message.speaker} persona={message.speaker === 'agent1' ? persona1 : persona2} model={message.speaker === 'agent1' ? model1 : model2} />
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
        </Fragment>
      ))}
      {isLoading && (
        <>
          {pendingSpeaker === 'agent1' && pendingTurn <= totalTurns && turnDivider(pendingTurn)}
          <article className={`message ${pendingSpeaker} typing`} role="status">
            <AgentHeading speaker={pendingSpeaker} persona={pendingSpeaker === 'agent1' ? persona1 : persona2} model={pendingSpeaker === 'agent1' ? model1 : model2} />
            <span className="typing-label">is thinking</span>
            <div className="typing-dots" aria-hidden="true"><span /><span /><span /></div>
            {messages.length === 0 && <p className="typing-hint">Loading a local model can take a moment.</p>}
          </article>
        </>
      )}
      <div ref={endRef} />
    </section>
  )
}
