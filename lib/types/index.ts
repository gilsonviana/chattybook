export interface Conversation {
  id: number
  subject: string
  model1: string
  model2: string
  totalTurns: number
  status: string
  createdAt: string
  updatedAt: string
  messages: Message[]
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
