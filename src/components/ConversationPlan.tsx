'use client'

import { useState } from 'react'
import { getTopicProgress, type TopicState } from '../../lib/topic-plan'
import type { ConversationTopic } from '../../lib/types'

const STATE_LABELS: Record<TopicState, string> = {
  covered: 'Covered',
  current: 'In progress',
  partial: 'Stopped mid-turn',
  upcoming: 'Upcoming',
  'not-reached': 'Not reached',
}

export function ConversationPlan({ topics, messageCount, status }: { topics: ConversationTopic[]; messageCount: number; status: string }) {
  const progress = getTopicProgress(topics.length, messageCount, status)
  // Expanded only for a fresh conversation so existing transcripts start at the dialogue.
  const [initiallyOpen] = useState(messageCount === 0)
  return (
    <details className="panel conversation-plan" open={initiallyOpen}>
      <summary>
        <span className="conversation-plan-title">Conversation plan</span>
        <span className="muted">
          {progress.currentIndex === null
            ? `${progress.coveredCount} of ${topics.length} topics covered`
            : `Topic ${progress.currentIndex + 1} of ${topics.length}: ${topics[progress.currentIndex].title}`}
        </span>
      </summary>
      <ol className="plan-topics">
        {topics.map((topic, index) => (
          <li key={topic.position} className={`plan-topic-${progress.states[index]}`} aria-current={progress.states[index] === 'current' ? 'step' : undefined}>
            <span className="plan-topic-turn"><span className="sr-only">Turn </span>{index + 1}</span>
            <div className="plan-topic-body">
              <strong>{topic.title}</strong>
              <p>{topic.description}</p>
              <span className="plan-topic-state">{STATE_LABELS[progress.states[index]]}</span>
            </div>
          </li>
        ))}
      </ol>
    </details>
  )
}
