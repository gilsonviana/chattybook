'use client'

import { useEffect, useRef } from 'react'
import { getPersonaLabel } from '../../lib/personas'
import type { Message } from '../../lib/types'

const reviewReasonLabels: Partial<Record<NonNullable<Message['reviewReason']>, string>> = {
  disconnected: 'It does not meaningfully build on the latest answer.',
  repetitive: 'It requests information already supplied in an earlier answer.',
  compound: 'It contains multiple independently answerable requests.',
  not_question_only: 'It includes content beyond one focused question.',
  reviewer_error: 'The reviewer failed to return a valid result.',
  timeout: 'The review timed out before verification finished.',
}

interface ChatWindowProps {
  title: string
  messages: Message[]
  isLoading: boolean
  totalTurns: number
  persona1: string
  persona2: string
  model1: string
  model2: string
}

export function ChatWindow({ title, messages, isLoading, totalTurns, persona1, persona2, model1, model2 }: ChatWindowProps) {
  const end = useRef<HTMLDivElement>(null)
  const completedTurns = Math.floor(messages.length / 2)
  const progress = totalTurns > 0 ? Math.floor(completedTurns / totalTurns * 100) : 0
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, isLoading])

  return (
    <section className="panel chat-window" aria-label="Agent dialogue" role="log" aria-live="polite">
      <header className="chat-header">
        <h2>{title}</h2>
        <p>{progress}%</p>
      </header>
      {messages.length === 0 && <p className="muted conversation-empty">The agents&apos; responses will appear here.</p>}
      {messages.map(message => (
        <article key={message.id} className={`message ${message.speaker}`}>
          <h3>Agent {message.speaker === 'agent1' ? '1' : '2'} ({getPersonaLabel(message.speaker === 'agent1' ? persona1 : persona2)}) - {message.speaker === 'agent1' ? model1 : model2} <span>Turn {message.turnNumber}</span></h3>
          <p>{message.content}</p>
          {(message.reviewStatus === 'rejected' || message.reviewStatus === 'unchecked') && (
            <p className="review-warning" role="note">
              {message.reviewStatus === 'rejected' ? 'Quality warning: follow-up did not pass review. ' : 'Quality warning: follow-up could not be verified. '}
              {(message.reviewReason && reviewReasonLabels[message.reviewReason]) || (message.reviewStatus === 'rejected' ? 'No reason was recorded.' : 'No details were recorded.')}
              {message.reviewExplanation && <> Reviewer: {message.reviewExplanation}</>}
            </p>
          )}
        </article>
      ))}
      {isLoading && <p className="thinking" role="status">Agent {messages.length % 2 + 1} ({getPersonaLabel(messages.length % 2 === 0 ? persona1 : persona2)}) is thinking... Loading a local model can take a moment.</p>}
      <div ref={end} />
    </section>
  )
}
