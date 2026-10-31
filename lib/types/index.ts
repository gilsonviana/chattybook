import type { ConversationMode } from '../conversation-mode'
import type { ResponseLength } from '../response-length'

export interface Conversation {
  id: number
  subject: string
  title: string | null
  model1: string
  model2: string
  reviewerModel: string | null
  persona1: string
  persona2: string
  mode: ConversationMode
  responseLength: ResponseLength
  totalTurns: number
  devilsAdvocate: boolean
  forkedFromId: number | null
  status: string
  createdAt: string
  updatedAt: string
  messages: Message[]
}

export interface ConversationSummary {
  id: number
  subject: string
  title: string | null
  reviewerModel: string | null
  status: string
  persona1: string
  persona2: string
  responseLength: ResponseLength
  devilsAdvocate: boolean
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
  reviewStatus: 'accepted' | 'rejected' | 'unchecked' | null
  reviewReason: 'ok' | 'disconnected' | 'repetitive' | 'compound' | 'not_question_only' | 'reviewer_error' | 'timeout' | null
  reviewExplanation: string | null
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
