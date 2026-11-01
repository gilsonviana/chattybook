import { NextResponse } from 'next/server'
import { errorResponse, readBody } from '../../../../lib/api'
import { parseConversationConfig, summarizeForkSource } from '../../../../lib/conversation'
import { requireLocalModels } from '../../../../lib/ollama'
import { generateTopicPlan, parseForkSummary, parsePreviousTopics } from '../../../../lib/topic-planner'

// Drafts a topic plan without saving anything; the plan is persisted only when the conversation is created.
export async function POST(request: Request) {
  try {
    const body = await readBody(request)
    const options = parseConversationConfig(body)
    const previousTopics = parsePreviousTopics(body.previousTopics)
    const providedSummary = options.forkedFromId === null ? null : parseForkSummary(body.forkSummary)
    await requireLocalModels([options.model1, options.model2], request.signal)
    const forkSummary = options.forkedFromId === null
      ? null
      : providedSummary === undefined ? await summarizeForkSource(options.forkedFromId, options.model1) : providedSummary
    const topics = await generateTopicPlan({ ...options, forkSummary, previousTopics }, request.signal)
    return NextResponse.json({ topics, forkSummary })
  } catch (error) {
    return errorResponse(error)
  }
}
