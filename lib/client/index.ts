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

export type { ChatMessage } from '../types'
