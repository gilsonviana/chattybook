import { NextResponse } from 'next/server'
import { checkOllamaHealth } from '../../../../../lib/ollama'

export async function GET() {
  const health = await checkOllamaHealth()
  return NextResponse.json(health, { status: health.running ? 200 : 503 })
}
