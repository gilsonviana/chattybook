'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, GitFork, Play, Plus, Square } from 'lucide-react'
import { requestJson } from '../../lib/client'
import type { Conversation, Message } from '../../lib/types'
import { ChatWindow } from './ChatWindow'
import { ConversationPlan } from './ConversationPlan'
import { ConversationSummary } from './ConversationSummary'

type DialogueUpdate = Pick<Conversation, 'messages' | 'status'>

async function generateDialogue(active: Conversation, update: (conversation: DialogueUpdate) => void, shouldStop: () => boolean) {
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
    update({ messages: history, status: current.status })
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
  const page = useRef<HTMLElement>(null)
  const chatEnd = useRef<HTMLDivElement>(null)
  const autoFollow = useRef(true)
  const programmaticScroll = useRef(false)
  const [scrollControls, setScrollControls] = useState({ top: false, bottom: false })
  const hasConversation = conversation !== null

  const loadConversation = useCallback(async () => {
    const active = await requestJson<Conversation>(`/api/conversation/${id}`)
    setConversation(active)
    setMessages(active.messages)
    return active
  }, [id])

  const applyDialogueUpdate = useCallback((updated: DialogueUpdate) => {
    setConversation(current => current ? { ...current, ...updated } : current)
    setMessages(updated.messages)
  }, [])

  function scrollToPosition(top: number) {
    const destination = Math.max(0, Math.min(top, document.documentElement.scrollHeight - window.innerHeight))
    programmaticScroll.current = Math.abs(window.scrollY - destination) > 1
    window.scrollTo({
      top: destination,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    })
  }

  function jumpToLatest() {
    if (!chatEnd.current) return
    autoFollow.current = true
    scrollToPosition(window.scrollY + chatEnd.current.getBoundingClientRect().bottom - window.innerHeight)
  }

  const followLatest = useEffectEvent(() => {
    if (autoFollow.current) jumpToLatest()
  })

  useEffect(() => {
    autoFollow.current = true
    let previousY = window.scrollY
    let touchY: number | null = null
    let frame = 0
    let scrollTimer: ReturnType<typeof setTimeout> | undefined

    function pauseFollow() {
      autoFollow.current = false
      if (programmaticScroll.current) {
        programmaticScroll.current = false
        window.scrollTo({ top: window.scrollY, behavior: 'instant' })
      }
    }

    function updateControls() {
      frame = 0
      const threshold = window.innerHeight / 2
      const endpoint = chatEnd.current
      const top = !!endpoint && window.scrollY > threshold
      const bottom = !!endpoint && endpoint.getBoundingClientRect().bottom - window.innerHeight > threshold
      setScrollControls(current => current.top === top && current.bottom === bottom ? current : { top, bottom })
    }

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(updateControls)
    }

    function finishScroll() {
      programmaticScroll.current = false
      clearTimeout(scrollTimer)
    }

    function onScroll() {
      if (!programmaticScroll.current && window.scrollY < previousY - 1) pauseFollow()
      previousY = window.scrollY
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(finishScroll, 180)
      scheduleUpdate()
    }

    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey && event.deltaY < 0) pauseFollow()
    }

    function onTouchStart(event: TouchEvent) {
      touchY = event.touches[0]?.clientY ?? null
    }

    function onTouchMove(event: TouchEvent) {
      const nextY = event.touches[0]?.clientY ?? null
      if (touchY !== null && nextY !== null && nextY > touchY) pauseFollow()
      touchY = nextY
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select, button, [role="menu"], [contenteditable="true"]')) return
      if (event.key === 'ArrowUp' || event.key === 'PageUp' || event.key === 'Home' || (event.key === ' ' && event.shiftKey)) pauseFollow()
    }

    function onPointerDown(event: PointerEvent) {
      if (event.clientX >= document.documentElement.clientWidth) {
        programmaticScroll.current = false
        window.scrollTo({ top: window.scrollY, behavior: 'instant' })
      }
    }

    function onResize() {
      previousY = window.scrollY
      scheduleUpdate()
    }

    const observer = new ResizeObserver(onResize)
    if (page.current) observer.observe(page.current)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scrollend', finishScroll)
    window.addEventListener('resize', onResize)
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    scheduleUpdate()
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
      clearTimeout(scrollTimer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('scrollend', finishScroll)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [id])

  useEffect(() => {
    if (hasConversation) followLatest()
  }, [messages.length, isLoading, hasConversation])

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    void (async () => {
      try {
        const active = await loadConversation()
        setIsLoading(false)

        if (window.sessionStorage.getItem('chattybook:new-conversation') === id) {
          window.sessionStorage.removeItem('chattybook:new-conversation')
          busy.current = true
          setIsLoading(true)
          try {
            await generateDialogue(active, applyDialogueUpdate, () => stopRequested.current)
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
  }, [id, loadConversation, applyDialogueUpdate])

  async function retryConversation() {
    if (busy.current || isStopping || !conversation) return
    busy.current = true
    stopRequested.current = false
    setIsLoading(true)
    setError('')
    try {
      const active = await loadConversation()
      if (active.status === 'generating') {
        await requestJson(`/api/conversation/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume: true }),
        })
      }
      const resumed = active.status === 'generating'
        ? await loadConversation()
        : active
      if (stopRequested.current) return
      if (resumed.status === 'completed') return
      await generateDialogue(resumed, applyDialogueUpdate, () => stopRequested.current)
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
      await loadConversation()
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

  const canResume = !isLoading && conversation?.status === 'generating'
  const stopLabel = isStopping ? 'Stopping...' : canResume ? 'Resume dialogue' : 'Stop dialogue'

  return (
    <main className="app conversation-page" ref={page}>
      {isLoading && !conversation && <p className="muted" role="status">Loading conversation...</p>}
      {error && <div className="error" role="alert">{error}</div>}
      {error && !conversation && <Link href="/">Back to conversations</Link>}
      {conversation && (
        <>
          <h1 className="conversation-title">{conversation.title ?? conversation.subject}</h1>
          {conversation.topics.length > 0 && (
            <ConversationPlan topics={conversation.topics} messageCount={messages.length} status={conversation.status} />
          )}
          <ChatWindow
            title={conversation.title ?? conversation.subject}
            messages={messages}
            topics={conversation.topics}
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
            endRef={chatEnd}
          />
          <div className="conversation-nav">
            <div className="conversation-actions">
              {(isStopping || (isLoading && conversation.status !== 'completed') || (!isLoading && conversation.status === 'generating')) && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={stopLabel}
                  data-tooltip={stopLabel}
                  onClick={() => void (canResume ? retryConversation() : stopConversation())}
                  disabled={isStopping}
                >
                  {canResume ? <Play size={18} aria-hidden="true" /> : <Square size={16} fill="currentColor" aria-hidden="true" />}
                </button>
              )}
              {!isLoading && !isStopping && conversation.status === 'active' && (
                <button type="button" className="icon-button" aria-label="Continue dialogue" data-tooltip="Continue dialogue" onClick={() => void retryConversation()}>
                  <Play size={18} aria-hidden="true" />
                </button>
              )}
              <Link href="/" className="icon-button" aria-label="New dialogue" data-tooltip="New dialogue">
                <Plus size={20} aria-hidden="true" />
              </Link>
            </div>
            <div className="conversation-actions">
              <button type="button" className="secondary icon-button" aria-label="Fork" data-tooltip="Fork" onClick={forkConversation}>
                <GitFork size={18} aria-hidden="true" />
              </button>
              <button type="button" className="secondary" onClick={exportPdf} disabled={conversation.status !== 'completed' || messages.length === 0}>Export to PDF</button>
            </div>
          </div>
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
          <ConversationSummary key={conversation.id} conversation={conversation} disabled={isLoading || isStopping} />
        </>
      )}
      {conversation && (scrollControls.top || scrollControls.bottom) && (
        <nav className="conversation-scroll" aria-label="Conversation navigation">
          {scrollControls.top && (
            <button
              type="button"
              className="scroll-top"
              aria-label="Jump to top"
              data-tooltip="Jump to top"
              onClick={() => {
                autoFollow.current = false
                scrollToPosition(0)
              }}
            >
              <ArrowUp size={20} aria-hidden="true" />
            </button>
          )}
          {scrollControls.bottom && (
            <button
              type="button"
              className="scroll-bottom"
              aria-label="Jump to latest message"
              data-tooltip="Jump to latest message"
              onClick={jumpToLatest}
            >
              <ArrowDown size={20} aria-hidden="true" />
            </button>
          )}
        </nav>
      )}
    </main>
  )
}
