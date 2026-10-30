export const CONVERSATION_MODES = ['discussion', 'qa'] as const

export type ConversationMode = typeof CONVERSATION_MODES[number]

export function isConversationMode(value: unknown): value is ConversationMode {
  return typeof value === 'string' && CONVERSATION_MODES.some(mode => mode === value)
}
