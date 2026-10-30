import { NextResponse } from 'next/server'
import { ApiError, errorResponse, readBody } from '../../../../lib/api'
import { runNextTurn } from '../../../../lib/conversation'

export async function POST(request: Request) {
  try {
    const { conversationId, expectedMessageCount } = await readBody(request)
    if (typeof conversationId !== 'number' || !Number.isSafeInteger(conversationId) || conversationId < 1 ||
        typeof expectedMessageCount !== 'number' || !Number.isSafeInteger(expectedMessageCount) || expectedMessageCount < 0) {
      throw new ApiError('A positive conversationId and non-negative expectedMessageCount are required.', 400)
    }
    return NextResponse.json(await runNextTurn(conversationId, expectedMessageCount))
  } catch (error) {
    return errorResponse(error)
  }
}
