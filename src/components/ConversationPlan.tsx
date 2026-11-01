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
  return (
    <details className="panel conversation-plan" open>
      <summary>
        Conversation plan
        <span className="muted">
          {progress.currentIndex === null
            ? ` · ${progress.coveredCount} of ${topics.length} topics covered`
            : ` · Topic ${progress.currentIndex + 1} of ${topics.length}`}
        </span>
      </summary>
      <ol className="plan-topics">
        {topics.map((topic, index) => (
          <li key={topic.position} className={`plan-topic-${progress.states[index]}`} aria-current={progress.states[index] === 'current' ? 'step' : undefined}>
            <span className="plan-topic-turn">Turn {index + 1} · {STATE_LABELS[progress.states[index]]}</span>
            <strong>{topic.title}</strong>
            <p>{topic.description}</p>
          </li>
        ))}
      </ol>
    </details>
  )
}
