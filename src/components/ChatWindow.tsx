'use client'

import { useEffect, useRef } from 'react'
import type { Message } from '../../lib/types'

interface ChatWindowProps {
  subject: string
  messages: Message[]
  isLoading: boolean
  totalTurns: number
}

export function ChatWindow({ subject, messages, isLoading, totalTurns }: ChatWindowProps) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages.length, isLoading])

  return (
    <section className="panel chat-window" aria-label="Agent dialogue">
      <header className="chat-header">
        <h2>{subject}</h2>
        <p>{Math.floor(messages.length / 2)} of {totalTurns} turns completed</p>
      </header>
      <div className="messages" role="log" aria-live="polite">
        {messages.length === 0 && <p className="muted">The agents&apos; responses will appear here.</p>}
        {messages.map(message => (
          <article key={message.id} className={`message ${message.speaker}`}>
            <h3>Agent {message.speaker === 'agent1' ? '1' : '2'} <span>Turn {message.turnNumber}</span></h3>
            <p>{message.content}</p>
          </article>
        ))}
        {isLoading && <p className="thinking" role="status">Agent {messages.length % 2 + 1} is thinking... Loading a local model can take a moment.</p>}
        <div ref={end} />
      </div>
    </section>
  )
}
