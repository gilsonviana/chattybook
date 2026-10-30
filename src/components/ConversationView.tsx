'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { requestJson } from '../../lib/client'
import type { Conversation, Message } from '../../lib/types'
import { ChatWindow } from './ChatWindow'

async function generateDialogue(active: Conversation, update: (conversation: Conversation) => void) {
  let history = active.messages
  let current = active
  while (history.length < current.totalTurns * 2) {
    const result = await requestJson<{ allMessages: Message[]; completed: boolean }>('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: current.id, expectedMessageCount: history.length }),
    })
    history = result.allMessages
    current = { ...current, messages: history, status: result.completed ? 'completed' : 'active' }
    update(current)
  }
}

export function ConversationView({ id }: { id: string }) {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const loaded = useRef(false)
  const busy = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    void (async () => {
      try {
        const active = await requestJson<Conversation>(`/api/conversation/${id}`)
        setConversation(active)
        setMessages(active.messages)
        setIsLoading(false)

        if (window.sessionStorage.getItem('chattybook:new-conversation') === id) {
          window.sessionStorage.removeItem('chattybook:new-conversation')
          busy.current = true
          setIsLoading(true)
          try {
            await generateDialogue(active, updated => {
              setConversation(updated)
              setMessages(updated.messages)
            })
          } catch (generationError) {
            setError(generationError instanceof Error ? generationError.message : 'Could not continue the dialogue.')
          } finally {
            busy.current = false
            setIsLoading(false)
          }
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load this conversation.')
        setIsLoading(false)
      }
    })()
  }, [id])

  async function retryConversation() {
    if (busy.current || !conversation) return
    busy.current = true
    setIsLoading(true)
    setError('')
    try {
      const active = await requestJson<Conversation>(`/api/conversation/${id}`)
      setConversation(active)
      setMessages(active.messages)
      await generateDialogue(active, updated => {
        setConversation(updated)
        setMessages(updated.messages)
      })
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : 'Could not continue the dialogue.')
    } finally {
      busy.current = false
      setIsLoading(false)
    }
  }

  return (
    <main className="app">
      <header className="page-header">
        <p className="eyebrow">LOCAL MODELS. REAL CONVERSATIONS.</p>
        <h1>ChattyBook</h1>
        <p>Two AI agents explore a subject, one response at a time.</p>
      </header>
      <div className="conversation-nav">
        <Link href="/">New dialogue</Link>
        {conversation && <span className="muted">Conversation {conversation.id}</span>}
      </div>
      {isLoading && !conversation && <p className="muted" role="status">Loading conversation...</p>}
      {error && <div className="error" role="alert">{error}</div>}
      {error && !conversation && <Link href="/">Back to conversations</Link>}
      {conversation && (
        <>
          <ChatWindow
            subject={conversation.subject}
            messages={messages}
            isLoading={isLoading}
            totalTurns={conversation.totalTurns}
            persona1={conversation.persona1}
            persona2={conversation.persona2}
          />
          <div className="actions">
            {!isLoading && conversation.status !== 'completed' && <button onClick={() => void retryConversation()}>Retry / continue dialogue</button>}
            {conversation.status === 'completed' && <strong role="status">Dialogue completed</strong>}
          </div>
          <p className="muted">Agent 1: {conversation.model1} / {conversation.persona1}; Agent 2: {conversation.model2} / {conversation.persona2}</p>
        </>
      )}
      <footer>Powered by local Ollama models. Conversations are saved on this computer.</footer>
    </main>
  )
}
