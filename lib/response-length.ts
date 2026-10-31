export const RESPONSE_LENGTHS = ['short', 'medium', 'long'] as const

export type ResponseLength = typeof RESPONSE_LENGTHS[number]

export const RESPONSE_LENGTH_SETTINGS: Record<ResponseLength, { maxTokens: number; instruction: string; qaInstruction: string }> = {
  short: {
    maxTokens: 256,
    instruction: 'Keep your response concise, using only a few sentences or one brief paragraph.',
    qaInstruction: 'Ask exactly one brief, focused question.',
  },
  medium: {
    maxTokens: 1024,
    instruction: 'Use a moderate level of detail, usually one or two paragraphs.',
    qaInstruction: 'Ask exactly one focused question that explores the subject.',
  },
  long: {
    maxTokens: 2048,
    instruction: 'Develop your response with substantial detail, using several paragraphs when useful.',
    qaInstruction: 'Ask exactly one thoughtful question, adding context within that question when useful.',
  },
}

export function isResponseLength(value: unknown): value is ResponseLength {
  return typeof value === 'string' && RESPONSE_LENGTHS.some(length => length === value)
}
