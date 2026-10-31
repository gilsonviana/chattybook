'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { requestJson } from '../../lib/client'
import type { Conversation, Message } from '../../lib/types'
import { ChatWindow } from './ChatWindow'

async function generateDialogue(active: Conversation, update: (conversation: Conversation) => void, shouldStop: () => boolean) {
  let history = active.messages
  let current = active
  while (!shouldStop() && history.length < current.totalTurns * 2) {
    const result = await requestJson<{ allMessages: Message[]; completed: boolean }>('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: current.id, expectedMessageCount: history.length }),
    })
    if (shouldStop()) return
    history = result.allMessages
    current = { ...current, messages: history, status: result.completed ? 'completed' : 'active' }
    update(current)
  }
}

export function ConversationView({ id }: { id: string }) {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isStopping, setIsStopping] = useState(false)
  const [error, setError] = useState('')
  const loaded = useRef(false)
  const busy = useRef(false)
  const stopRequested = useRef(false)

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
            }, () => stopRequested.current)
          } catch (generationError) {
            if (!stopRequested.current) {
              setError(generationError instanceof Error ? generationError.message : 'Could not continue the dialogue.')
            }
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
    if (busy.current || isStopping || !conversation) return
    busy.current = true
    stopRequested.current = false
    setIsLoading(true)
    setError('')
    try {
      const active = await requestJson<Conversation>(`/api/conversation/${id}`)
      setConversation(active)
      setMessages(active.messages)
      if (stopRequested.current) return
      await generateDialogue(active, updated => {
        setConversation(updated)
        setMessages(updated.messages)
      }, () => stopRequested.current)
    } catch (retryError) {
      if (!stopRequested.current) {
        setError(retryError instanceof Error ? retryError.message : 'Could not continue the dialogue.')
      }
    } finally {
      busy.current = false
      setIsLoading(false)
    }
  }

  async function stopConversation() {
    if (!conversation || isStopping) return
    stopRequested.current = true
    setIsStopping(true)
    setError('')
    try {
      await requestJson(`/api/conversation/${id}`, { method: 'PATCH' })
      setConversation(current => current ? { ...current, status: 'completed' } : current)
      setIsLoading(false)
      const stopped = await requestJson<Conversation>(`/api/conversation/${id}`)
      setConversation(stopped)
      setMessages(stopped.messages)
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : 'Could not stop the dialogue.')
    } finally {
      setIsStopping(false)
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
            model1={conversation.model1}
            model2={conversation.model2}
          />
          {(isStopping || ((isLoading || conversation.status === 'generating') && conversation.status !== 'completed')) && (
            <div className="actions">
              <button type="button" onClick={() => void stopConversation()} disabled={isStopping}>
                {isStopping ? 'Stopping...' : 'Stop'}
              </button>
            </div>
          )}
          {!isLoading && !isStopping && conversation.status === 'active' && (
            <div className="actions">
              <button onClick={() => void retryConversation()}>Retry / continue dialogue</button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
