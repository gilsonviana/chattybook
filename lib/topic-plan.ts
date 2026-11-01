import { contentTokens, isNearDuplicate, normalizeText, withoutTokens } from './text-similarity'

export interface PlannedTopic {
  title: string
  description: string
}

export const TOPIC_TITLE_LIMITS = { min: 3, max: 100 }
export const TOPIC_DESCRIPTION_LIMITS = { min: 15, max: 400 }

// Reports problems for topics from `start` onward, comparing each with every earlier topic.
export function findTopicProblems(topics: PlannedTopic[], subject: string, start = 0): string[] {
  const subjectTokens = contentTokens(subject)
  const titles = topics.map(topic => withoutTokens(contentTokens(topic.title), subjectTokens))
  const combined = topics.map(topic => withoutTokens(contentTokens(`${topic.title} ${topic.description}`), subjectTokens))
  const problems: string[] = []
  for (let index = start; index < topics.length; index++) {
    const { title, description } = topics[index]
    const label = `Topic ${index + 1}`
    if (title.length < TOPIC_TITLE_LIMITS.min || title.length > TOPIC_TITLE_LIMITS.max) {
      problems.push(`${label} needs a title of ${TOPIC_TITLE_LIMITS.min} to ${TOPIC_TITLE_LIMITS.max} characters.`)
    }
    if (description.length < TOPIC_DESCRIPTION_LIMITS.min || description.length > TOPIC_DESCRIPTION_LIMITS.max) {
      problems.push(`${label} needs a description of ${TOPIC_DESCRIPTION_LIMITS.min} to ${TOPIC_DESCRIPTION_LIMITS.max} characters.`)
    }
    for (let earlier = 0; earlier < index; earlier++) {
      if (normalizeText(title) === normalizeText(topics[earlier].title) ||
          isNearDuplicate(titles[index], titles[earlier], 0.75) ||
          isNearDuplicate(combined[index], combined[earlier], 0.6)) {
        problems.push(`${label} (${JSON.stringify(title)}) overlaps topic ${earlier + 1} (${JSON.stringify(topics[earlier].title)}); replace it with a distinct aspect.`)
        break
      }
    }
  }
  return problems
}

export function validateTopicPlan(topics: PlannedTopic[], totalTurns: number, subject: string): string[] {
  return [
    ...(topics.length === totalTurns ? [] : [`The plan has ${topics.length} topics; exactly ${totalTurns} are required.`]),
    ...findTopicProblems(topics, subject),
  ]
}

export type TopicState = 'covered' | 'current' | 'partial' | 'upcoming' | 'not-reached'

export interface TopicProgress {
  currentIndex: number | null
  coveredCount: number
  states: TopicState[]
}

// A turn counts as covered only after both agents' messages are saved.
export function getTopicProgress(topicCount: number, messageCount: number, status: string): TopicProgress {
  const coveredCount = Math.min(Math.floor(messageCount / 2), topicCount)
  const finished = status === 'completed'
  const currentIndex = !finished && coveredCount < topicCount ? coveredCount : null
  const states = Array.from({ length: topicCount }, (_, index): TopicState => {
    if (index < coveredCount) return 'covered'
    if (index === currentIndex) return 'current'
    if (finished && index === coveredCount && messageCount % 2 === 1) return 'partial'
    return finished ? 'not-reached' : 'upcoming'
  })
  return { currentIndex, coveredCount, states }
}
