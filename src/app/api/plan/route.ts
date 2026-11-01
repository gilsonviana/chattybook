import { NextResponse } from 'next/server'
import { ApiError, errorResponse, readBody } from '../../../../lib/api'
import { loadForkTopics, parseConversationConfig, summarizeForkSource } from '../../../../lib/conversation'
import { requireLocalModels } from '../../../../lib/ollama'
import { generateTopicPlan, parseForkSummary, parsePreviousTopics } from '../../../../lib/topic-planner'

// Drafts a topic plan without saving anything; the plan is persisted only when the conversation is created.
export async function POST(request: Request) {
  try {
    const body = await readBody(request)
    const options = parseConversationConfig(body)
    const previousTopics = parsePreviousTopics(body.previousTopics)
    const providedSummary = options.forkedFromId === null ? null : parseForkSummary(body.forkSummary)
    if (body.planModel !== undefined && (typeof body.planModel !== 'string' || !body.planModel.trim())) {
      throw new ApiError('planModel must be a local model name.', 400)
    }
    const planModel = typeof body.planModel === 'string' ? body.planModel.trim() : options.model1
    await requireLocalModels([options.model1, options.model2, planModel], request.signal)
    const forkSummary = options.forkedFromId === null
      ? null
      : providedSummary === undefined ? await summarizeForkSource(options.forkedFromId, options.model1) : providedSummary
    const forkTopics = options.forkedFromId === null ? [] : await loadForkTopics(options.forkedFromId)
    const { topics, incomplete } = await generateTopicPlan({ ...options, planModel, forkSummary, forkTopics, previousTopics }, request.signal)
    return NextResponse.json({ topics, forkSummary, requestedCount: options.totalTurns, incomplete })
  } catch (error) {
    return errorResponse(error)
  }
}
