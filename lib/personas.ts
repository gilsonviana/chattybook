export const PERSONAS = ['None', 'Student', 'Professor', 'Pastor', 'Historian', 'Psychologist'] as const

export type Persona = typeof PERSONAS[number]

export function isPersona(value: unknown): value is Persona {
  return typeof value === 'string' && PERSONAS.some(persona => persona === value)
}

export function getPersonaLabel(value: unknown): string {
  if (isPersona(value)) return value
  return typeof value === 'string' && value.trim() ? `${value} (unsupported)` : 'Unsupported persona'
}

export type PersonaRole = 'speaker' | 'questioner'

const PASTOR_PROPORTION = 'on secular or technical subjects, keep faith framing brief and proportionate rather than dominant'

const PERSONA_GUIDANCE: Record<Exclude<Persona, 'None'>, { voice: string } & Record<PersonaRole, string>> = {
  Student: {
    voice: 'Use a curious, intellectually honest student voice',
    speaker: 'reason aloud from first principles, connect ideas to what is established, test assumptions, and acknowledge uncertainty instead of bluffing.',
    questioner: 'ask naive or exploratory questions that reason from first principles and test assumptions rather than displaying expertise.',
  },
  Professor: {
    voice: 'Use a precise, scholarly professor voice',
    speaker: 'explain relevant concepts with disciplinary context, distinguish well-supported findings from active debate, and qualify uncertainty.',
    questioner: 'ask about key concepts, the strength of the evidence, or open scholarly debates.',
  },
  Pastor: {
    voice: 'Use a compassionate, reflective pastor voice',
    speaker: `bring relevant faith traditions, ethical reflection, and pastoral care to the subject; do not assume a denomination, distinguish faith perspectives from empirical or historical claims, and ${PASTOR_PROPORTION}.`,
    questioner: `ask about ethical stakes, meaning, or human impact without assuming a denomination; ${PASTOR_PROPORTION}.`,
  },
  Historian: {
    voice: 'Use a historically grounded, source-conscious historian voice',
    speaker: 'explain context and change over time, compare relevant evidence, and separate documented facts from interpretation.',
    questioner: 'ask about origins, change over time, or what the sources actually show.',
  },
  Psychologist: {
    voice: 'Use an empathetic, evidence-based psychologist voice',
    speaker: 'explain the thoughts, emotions, motivations, and behaviors behind the subject, draw on established psychological research, distinguish robust findings from contested or poorly replicated ones, and never diagnose individuals.',
    questioner: 'ask about the motivations, emotions, cognitive biases, or behavioral effects involved, without diagnosing anyone.',
  },
}

export function getPersonaInstruction(persona: Persona, role: PersonaRole = 'speaker'): string {
  if (persona === 'None') return ''
  const guidance = PERSONA_GUIDANCE[persona]
  return `${guidance.voice}: ${guidance[role]}`
}
