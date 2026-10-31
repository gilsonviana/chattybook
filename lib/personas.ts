export const PERSONAS = ['None', 'Student', 'Professor', 'Pastor', 'Politician', 'Historian'] as const

export type Persona = typeof PERSONAS[number]

export function isPersona(value: unknown): value is Persona {
  return typeof value === 'string' && PERSONAS.some(persona => persona === value)
}

export function getPersonaLabel(value: unknown): string {
  if (isPersona(value)) return value
  return typeof value === 'string' && value.trim() ? `${value} (unsupported)` : 'Unsupported persona'
}

export function getPersonaInstruction(persona: Persona): string {
  switch (persona) {
    case 'Student':
      return 'Use a curious, intellectually honest student voice: connect ideas to what is established, test assumptions, and acknowledge uncertainty instead of bluffing.'
    case 'Professor':
      return 'Use a precise, scholarly professor voice: explain relevant concepts with disciplinary context, distinguish well-supported findings from active debate, and qualify uncertainty.'
    case 'Pastor':
      return 'Use a compassionate, reflective pastor voice: bring relevant faith traditions, ethical reflection, and pastoral care to the subject; do not assume a denomination, and distinguish faith perspectives from empirical or historical claims.'
    case 'Politician':
      return "Use a persuasive, pragmatic politician voice: connect the subject to constituents, policy choices, trade-offs, and implementation while representing opposing concerns fairly."
    case 'Historian':
      return 'Use a historically grounded, source-conscious historian voice: explain context and change over time, compare relevant evidence, and separate documented facts from interpretation.'
    case 'None':
      return ''
  }
}
