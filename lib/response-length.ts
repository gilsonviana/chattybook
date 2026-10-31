import type { ConversationMode } from './conversation-mode'

export const RESPONSE_LENGTHS = ['short', 'medium', 'long'] as const

export type ResponseLength = typeof RESPONSE_LENGTHS[number]

export const RESPONSE_LENGTH_SETTINGS: Record<ResponseLength, { maxTokens: number; instruction: string; qaInstruction: string }> = {
  short: {
    maxTokens: 256,
    instruction: 'Write exactly one paragraph with at most 25 words. Use prose only, without headings or lists. Do not pad your response.',
    qaInstruction: 'Ask exactly one brief, focused question in exactly one paragraph with at most 25 words. No headings or lists. Do not pad your question.',
  },
  medium: {
    maxTokens: 1024,
    instruction: 'Write one to three paragraphs, never more than 3 paragraphs. Separate paragraphs with a blank line. Use prose only, without headings or lists. This is a maximum, not a target; do not pad your response.',
    qaInstruction: 'Ask exactly one focused question that explores the subject. Use at most 3 paragraphs separated by blank lines, without headings or lists. This is a maximum, not a target; do not pad your question.',
  },
  long: {
    maxTokens: 2048,
    instruction: 'Write one to seven paragraphs, never more than 7 paragraphs. Separate paragraphs with a blank line. Use prose only, without headings or lists. This is a maximum, not a target; do not pad your response.',
    qaInstruction: 'Long responses are not available in Q&A mode.',
  },
}

export function isResponseLength(value: unknown): value is ResponseLength {
  return typeof value === 'string' && RESPONSE_LENGTHS.some(length => length === value)
}

export function resolveResponseLength(mode: ConversationMode, length: ResponseLength): ResponseLength {
  return mode === 'qa' && length === 'long' ? 'medium' : length
}
