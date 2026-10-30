import { NextResponse } from 'next/server'
import { listOllamaModels } from '../../../../../lib/ollama'

export async function GET() {
  try {
    const models = await listOllamaModels()
    return NextResponse.json({ models })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message, models: [] }, { status: 503 })
  }
}
