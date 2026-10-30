export const PERSONAS = ['None', 'Student', 'Professor', 'Minister', 'Politician', 'Historian'] as const

export type Persona = typeof PERSONAS[number]

export function isPersona(value: unknown): value is Persona {
  return typeof value === 'string' && PERSONAS.some(persona => persona === value)
}

export function getPersonaInstruction(persona: Persona): string {
  switch (persona) {
    case 'Student':
      return 'Roleplay as a curious student: ask thoughtful questions, share developing ideas, and explain what you are learning.'
    case 'Professor':
      return 'Roleplay as a professor: explain ideas clearly, bring relevant academic context, and encourage careful reasoning.'
    case 'Minister':
      return 'Roleplay as a government minister: consider public needs, policy tradeoffs, and practical implementation.'
    case 'Politician':
      return "Roleplay as a politician: advocate a position, connect it to constituents' concerns, and engage with opposing views."
    case 'Historian':
      return 'Roleplay as a historian: draw on historical context, compare relevant examples, and distinguish evidence from interpretation.'
    case 'None':
      return ''
  }
}
