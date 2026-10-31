'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
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
      if (active.status === 'generating') {
        await requestJson(`/api/conversation/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume: true }),
        })
      }
      const resumed = active.status === 'generating'
        ? await requestJson<Conversation>(`/api/conversation/${id}`)
        : active
      setConversation(resumed)
      setMessages(resumed.messages)
      if (stopRequested.current) return
      if (resumed.status === 'completed') return
      await generateDialogue(resumed, updated => {
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

  function forkConversation() {
    window.sessionStorage.setItem('chattybook:fork', id)
    router.push('/')
  }

  function exportPdf() {
    if (!conversation) return
    // The browser's print dialog offers Save as PDF; the document title becomes the default file name.
    const previousTitle = document.title
    document.title = `ChattyBook - ${conversation.title ?? conversation.subject}`
    window.addEventListener('afterprint', () => { document.title = previousTitle }, { once: true })
    window.print()
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
        {conversation && (
          <div className="conversation-actions">
            <button type="button" className="secondary" onClick={forkConversation}>Fork</button>
            <button type="button" className="secondary" onClick={exportPdf} disabled={conversation.status !== 'completed' || messages.length === 0}>Export to PDF</button>
          </div>
        )}
      </div>
      {isLoading && !conversation && <p className="muted" role="status">Loading conversation...</p>}
      {error && <div className="error" role="alert">{error}</div>}
      {error && !conversation && <Link href="/">Back to conversations</Link>}
      {conversation && (
        <>
          <ChatWindow
            title={conversation.title ?? conversation.subject}
            reviewerModel={conversation.reviewerModel}
            messages={messages}
            isLoading={isLoading}
            totalTurns={conversation.totalTurns}
            persona1={conversation.persona1}
            persona2={conversation.persona2}
            model1={conversation.model1}
            model2={conversation.model2}
            devilsAdvocate={conversation.devilsAdvocate}
            forkedFromId={conversation.forkedFromId}
            forkSummary={conversation.forkSummary}
            forkCount={conversation.forks.length}
          />
          {(isStopping || (isLoading && conversation.status !== 'completed') || (!isLoading && conversation.status === 'generating')) && (
            <div className="actions">
              <button
                type="button"
                onClick={() => void (!isLoading && conversation.status === 'generating' ? retryConversation() : stopConversation())}
                disabled={isStopping}
              >
                {isStopping ? 'Stopping...' : !isLoading && conversation.status === 'generating' ? 'Resume' : 'Stop'}
              </button>
            </div>
          )}
          {!isLoading && !isStopping && conversation.status === 'active' && (
            <div className="actions">
              <button onClick={() => void retryConversation()}>Retry / continue dialogue</button>
            </div>
          )}
          {conversation.forks.length > 0 && (
            <nav id="conversation-forks" className="fork-continuation panel" aria-labelledby="fork-continuation-heading">
              <h2 id="fork-continuation-heading">Continue reading</h2>
              <p className="muted">
                This dialogue was forked into {conversation.forks.length === 1 ? 'another conversation' : `${conversation.forks.length} conversations`} that continue the subject without repeating its key points.
              </p>
              <ul>
                {conversation.forks.map(fork => (
                  <li key={fork.id}>
                    <Link href={`/conversation/${fork.id}`}>
                      <span>{fork.title ?? fork.subject}</span>
                      <span className="fork-continuation-meta">
                        {new Date(fork.createdAt).toLocaleDateString()}{fork.status === 'completed' ? '' : ' · In progress'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </>
      )}
    </main>
  )
}
