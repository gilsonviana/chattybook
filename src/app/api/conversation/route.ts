import { NextResponse } from 'next/server'
import { ApiError, errorResponse, readBody } from '../../../../lib/api'
import { initializeConversation } from '../../../../lib/conversation'
import { isConversationMode } from '../../../../lib/conversation-mode'
import { isPersona } from '../../../../lib/personas'
import { isResponseLength, resolveResponseLength } from '../../../../lib/response-length'
import { prisma } from '../../../../lib/db'

export async function GET() {
  try {
    const conversations = await prisma.conversation.findMany({
      select: {
        id: true,
        subject: true,
        title: true,
        reviewerModel: true,
        reviewEnabled: true,
        status: true,
        persona1: true,
        persona2: true,
        responseLength: true,
        devilsAdvocate: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return NextResponse.json(conversations.map(({ _count, ...conversation }) => ({
      ...conversation,
      messageCount: _count.messages,
    })))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { subject, model1, model2, reviewerModel = null, reviewEnabled = true, persona1 = 'None', persona2 = 'None', mode = 'discussion', responseLength = 'medium', totalTurns = 5, devilsAdvocate = false, forkedFromId = null } = await readBody(request)
    if (typeof subject !== 'string' || !subject.trim() ||
        typeof model1 !== 'string' || !model1.trim() ||
        typeof model2 !== 'string' || !model2.trim()) {
      throw new ApiError('A discussion subject and two local models are required.', 400)
    }
    if (reviewerModel !== null && (typeof reviewerModel !== 'string' || !reviewerModel.trim())) {
      throw new ApiError('Review model must be an installed local model or null.', 400)
    }
    if (typeof reviewEnabled !== 'boolean') {
      throw new ApiError('Review enabled must be true or false.', 400)
    }
    if (!isPersona(persona1) || !isPersona(persona2)) {
      throw new ApiError('Each agent persona must be one of the supported options.', 400)
    }
    if (!isConversationMode(mode)) {
      throw new ApiError('Conversation mode must be discussion or qa.', 400)
    }
    if (!isResponseLength(responseLength)) {
      throw new ApiError('Response length must be short, medium, or long.', 400)
    }
    if (resolveResponseLength(mode, responseLength) !== responseLength) {
      throw new ApiError('Long responses are not available in Q&A mode. Choose short or medium.', 400)
    }
    if (typeof totalTurns !== 'number' || !Number.isInteger(totalTurns) || totalTurns < 1 || totalTurns > 100) {
      throw new ApiError('Number of turns must be an integer between 1 and 100.', 400)
    }
    if (typeof devilsAdvocate !== 'boolean') {
      throw new ApiError("Devil's advocate mode must be true or false.", 400)
    }
    if (forkedFromId !== null && (typeof forkedFromId !== 'number' || !Number.isSafeInteger(forkedFromId) || forkedFromId < 1)) {
      throw new ApiError('forkedFromId must be a conversation ID or null.', 400)
    }
    const conversation = await initializeConversation({
      subject: subject.trim(), model1: model1.trim(), model2: model2.trim(),
      reviewerModel: typeof reviewerModel === 'string' ? reviewerModel.trim() : null,
      reviewEnabled, persona1, persona2, mode, responseLength, totalTurns, devilsAdvocate, forkedFromId,
    })
    return NextResponse.json(conversation, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
