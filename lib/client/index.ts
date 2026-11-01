import { isConversationMode, type ConversationMode } from '../conversation-mode'
import { isPersona, type Persona } from '../personas'
import { isResponseLength, type ResponseLength } from '../response-length'

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${response.status}).`)
  }
  return data as T
}

export async function getOllamaModels(): Promise<string[]> {
  const { models } = await requestJson<{ models: string[] }>('/api/ollama/models')
  return models
}

const PLAN_DRAFT_KEY = 'chattybook:plan-draft'

export interface PlanDraft {
  config: {
    subject: string
    model1: string
    model2: string
    persona1: Persona
    persona2: Persona
    mode: ConversationMode
    responseLength: ResponseLength
    totalTurns: number
    devilsAdvocate: boolean
    forkedFromId: number | null
  }
  forkSource: { id: number; subject: string; title: string | null } | null
}

export function savePlanDraft(draft: PlanDraft) {
  window.sessionStorage.setItem(PLAN_DRAFT_KEY, JSON.stringify(draft))
}

export function clearPlanDraft() {
  window.sessionStorage.removeItem(PLAN_DRAFT_KEY)
}

// The server revalidates every field, so this only guards against stale or hand-edited storage.
export function readPlanDraft(): PlanDraft | null {
  try {
    const draft: unknown = JSON.parse(window.sessionStorage.getItem(PLAN_DRAFT_KEY) ?? 'null')
    if (!draft || typeof draft !== 'object') return null
    const { config, forkSource } = draft as Partial<PlanDraft>
    if (!config || typeof config.subject !== 'string' || !config.subject.trim() ||
        typeof config.model1 !== 'string' || typeof config.model2 !== 'string' ||
        !isPersona(config.persona1) || !isPersona(config.persona2) ||
        !isConversationMode(config.mode) || !isResponseLength(config.responseLength) ||
        !Number.isInteger(config.totalTurns) || typeof config.devilsAdvocate !== 'boolean' ||
        (config.forkedFromId !== null && !Number.isSafeInteger(config.forkedFromId))) return null
    return { config, forkSource: forkSource && typeof forkSource.id === 'number' ? forkSource : null }
  } catch {
    return null
  }
}

export type { ChatMessage } from '../types'
