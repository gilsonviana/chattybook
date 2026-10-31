'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { getPersonaLabel } from '../../lib/personas'
import type { Message } from '../../lib/types'

const reviewReasonLabels: Partial<Record<NonNullable<Message['reviewReason']>, string>> = {
  disconnected: 'It does not meaningfully build on the latest answer.',
  repetitive: 'It repeats an earlier question or requests information already supplied.',
  compound: 'It contains multiple independently answerable requests.',
  not_question_only: 'It includes content beyond one focused question.',
  reviewer_error: 'The reviewer failed to return a valid result.',
  timeout: 'The review timed out before verification finished.',
}

interface ChatWindowProps {
  title: string
  reviewerModel: string | null
  messages: Message[]
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
}

export function ChatWindow({ title, reviewerModel, messages, isLoading, totalTurns, persona1, persona2, model1, model2, devilsAdvocate, forkedFromId, forkSummary, forkCount }: ChatWindowProps) {
  const end = useRef<HTMLDivElement>(null)
  const [copyStatus, setCopyStatus] = useState<{ messageId: number; status: 'copied' | 'error' } | null>(null)
  const completedTurns = Math.floor(messages.length / 2)
  const progress = totalTurns > 0 ? Math.floor(completedTurns / totalTurns * 100) : 0

  async function copyResponse(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopyStatus({ messageId: message.id, status: 'copied' })
    } catch {
      setCopyStatus({ messageId: message.id, status: 'error' })
    }
  }

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, isLoading])

  return (
    <section className="panel chat-window" aria-label="Agent dialogue" role="log" aria-live="polite">
      <header className="chat-header">
        <div className="chat-title">
          <h2>{title}</h2>
          {reviewerModel && <p className="reviewer-model">Reviewer: {reviewerModel}</p>}
          {devilsAdvocate && <p className="reviewer-model">Devil&apos;s advocate: Agent 1 challenges Agent 2</p>}
          {forkedFromId !== null && <p className="reviewer-model">Forked from <Link href={`/conversation/${forkedFromId}`}>conversation #{forkedFromId}</Link></p>}
          {forkCount > 0 && <p className="reviewer-model"><a href="#conversation-forks">Forked into {forkCount === 1 ? '1 conversation' : `${forkCount} conversations`}</a></p>}
        </div>
        <p className="chat-progress">{progress}%</p>
      </header>
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
          <p>{message.content}</p>
          <button
            type="button"
            className="message-copy"
            aria-label={`Copy response from Agent ${message.speaker === 'agent1' ? '1' : '2'}`}
            onClick={() => void copyResponse(message)}
          >
            {copyStatus?.messageId === message.id
              ? copyStatus.status === 'copied' ? 'Copied' : 'Copy failed'
              : 'Copy response'}
          </button>
          {(message.reviewStatus === 'rejected' || message.reviewStatus === 'unchecked') && (
            <p className="review-warning" role="note">
              {message.reviewStatus === 'rejected' ? 'Quality warning: follow-up did not pass review. ' : 'Quality warning: follow-up could not be verified. '}
              {(message.reviewReason && reviewReasonLabels[message.reviewReason]) || (message.reviewStatus === 'rejected' ? 'No reason was recorded.' : 'No details were recorded.')}
              {message.reviewExplanation && <> Reviewer: {message.reviewExplanation}</>}
            </p>
          )}
        </article>
      ))}
      {isLoading && (() => {
        const speaker = messages.length % 2 === 0 ? 'agent1' : 'agent2'
        const number = speaker === 'agent1' ? '1' : '2'
        return (
          <article className={`message ${speaker} typing`} role="status">
            <h3>Agent {number} ({getPersonaLabel(speaker === 'agent1' ? persona1 : persona2)}) - {speaker === 'agent1' ? model1 : model2}</h3>
            <span className="typing-label">is thinking</span>
            <div className="typing-dots" aria-hidden="true"><span /><span /><span /></div>
            {messages.length === 0 && <p className="typing-hint">Loading a local model can take a moment.</p>}
          </article>
        )
      })()}
      <div ref={end} />
    </section>
  )
}
