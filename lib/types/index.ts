import type { ConversationMode } from '../conversation-mode'
import type { ResponseLength } from '../response-length'

export interface Conversation {
  id: number
  subject: string
  title: string | null
  model1: string
  model2: string
  persona1: string
  persona2: string
  mode: ConversationMode
  responseLength: ResponseLength
  totalTurns: number
  devilsAdvocate: boolean
  forkedFromId: number | null
  forkSummary: string | null
  summary: string | null
  summaryModel: string | null
  forks: ConversationFork[]
  topics: ConversationTopic[]
  status: string
  createdAt: string
  updatedAt: string
  messages: Message[]
}

export interface ConversationTopic {
  position: number
  title: string
  description: string
}

export type ConversationFork = Pick<Conversation, 'id' | 'subject' | 'title' | 'status' | 'createdAt'>

export interface ConversationSummary {
  id: number
  subject: string
  title: string | null
  status: string
  persona1: string
  persona2: string
  responseLength: ResponseLength
  devilsAdvocate: boolean
  forkedFromId: number | null
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface Message {
  id: number
  conversationId: number
  speaker: 'agent1' | 'agent2'
  role: string
  content: string
  turnNumber: number
  createdAt: string
}

// Ollama types
export interface OllamaModel {
  name: string
  modem?: string
  modified?: string
  size?: number
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}
