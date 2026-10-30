import { NextResponse } from 'next/server'
import { ApiError, errorResponse, readBody } from '../../../../lib/api'
import { initializeConversation } from '../../../../lib/conversation'
import { isConversationMode } from '../../../../lib/conversation-mode'
import { isPersona } from '../../../../lib/personas'
import { isResponseLength } from '../../../../lib/response-length'

export async function POST(request: Request) {
  try {
    const { subject, model1, model2, persona1 = 'None', persona2 = 'None', mode = 'discussion', responseLength = 'medium', totalTurns = 5 } = await readBody(request)
    if (typeof subject !== 'string' || !subject.trim() ||
        typeof model1 !== 'string' || !model1.trim() ||
        typeof model2 !== 'string' || !model2.trim()) {
      throw new ApiError('A discussion subject and two local models are required.', 400)
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
    if (typeof totalTurns !== 'number' || !Number.isInteger(totalTurns) || totalTurns < 1 || totalTurns > 100) {
      throw new ApiError('Number of turns must be an integer between 1 and 100.', 400)
    }
    const conversation = await initializeConversation({
      subject: subject.trim(), model1: model1.trim(), model2: model2.trim(), persona1, persona2, mode, responseLength, totalTurns,
    })
    return NextResponse.json(conversation, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
