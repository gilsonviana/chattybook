import { Ollama, type Message } from 'ollama'
import { ApiError } from './api'

function localHost(): string {
  const host = new URL(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434')
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(host.hostname) ||
    !['http:', 'https:'].includes(host.protocol) ||
    host.username || host.password
  ) {
    throw new ApiError('OLLAMA_BASE_URL must point to a local Ollama server.', 503)
  }
  return host.origin
}

function client(timeout: number, signal?: AbortSignal) {
  return new Ollama({
    host: localHost(),
    fetch: (input, init) => fetch(input, {
      ...init,
      cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
    }),
  })
}

function connectionError(error: unknown): ApiError {
  const detail = error instanceof Error ? error.message : 'Unknown error'
  return new ApiError(`Ollama request failed: ${detail}. Check that Ollama is running locally (ollama serve).`, 503)
}

export interface OllamaHealth {
  running: boolean
  version?: string
  error?: string
}

export async function checkOllamaHealth(): Promise<OllamaHealth> {
  try {
    const { version } = await client(5000).version()
    return { running: true, version }
  } catch (error) {
    return { running: false, error: connectionError(error).message }
  }
}

export async function listOllamaModels(signal?: AbortSignal): Promise<string[]> {
  try {
    const { models } = await client(5000, signal).list()
    return models
      .filter(model => !model.name.includes(':cloud') &&
        !('remote_model' in model && model.remote_model) &&
        !('remote_host' in model && model.remote_host))
      .map(model => model.name)
  } catch (error) {
    throw connectionError(error)
  }
}

export async function requireLocalModels(names: string[], signal?: AbortSignal) {
  signal?.throwIfAborted()
  const available = await listOllamaModels(signal)
  for (const name of new Set(names)) {
    signal?.throwIfAborted()
    if (!available.includes(name)) {
      throw new ApiError(`Model "${name}" is not installed locally. Choose an available model or run ollama pull <model>.`, 400)
    }
    // Cloud aliases can have custom names; inspect their metadata as well.
    const details = await client(5000, signal).show({ model: name }).catch(error => {
      throw connectionError(error)
    })
    if (('remote_model' in details && details.remote_model) ||
        ('remote_host' in details && details.remote_host)) {
      throw new ApiError('Cloud models are not supported. Choose a locally installed model.', 400)
    }
  }
}

export async function generateChatResponse(model: string, messages: Message[], maxTokens: number, signal?: AbortSignal): Promise<string> {
  try {
    signal?.throwIfAborted()
    const response = await client(300000, signal).chat({
      model,
      messages,
      stream: false,
      // GPT-OSS requires a thinking level rather than a boolean.
      think: model.startsWith('gpt-oss') ? 'low' : false,
      options: { num_predict: maxTokens },
    })
    const content = response.message?.content?.trim()
    if (!content) {
      throw new ApiError(`Model "${model}" returned no answer text. Try another local chat model.`, 502)
    }
    return content
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw connectionError(error)
  }
}
