import { NextResponse } from 'next/server'
import { ApiError, errorResponse, readBody } from '../../../../lib/api'
import { initializeConversation } from '../../../../lib/conversation'

export async function POST(request: Request) {
  try {
    const { subject, model1, model2, totalTurns = 5 } = await readBody(request)
    if (typeof subject !== 'string' || !subject.trim() ||
        typeof model1 !== 'string' || !model1.trim() ||
        typeof model2 !== 'string' || !model2.trim()) {
      throw new ApiError('A discussion subject and two local models are required.', 400)
    }
    if (typeof totalTurns !== 'number' || !Number.isInteger(totalTurns) || totalTurns < 1 || totalTurns > 100) {
      throw new ApiError('Number of turns must be an integer between 1 and 100.', 400)
    }
    const conversation = await initializeConversation({
      subject: subject.trim(), model1: model1.trim(), model2: model2.trim(), totalTurns,
    })
    return NextResponse.json(conversation, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
