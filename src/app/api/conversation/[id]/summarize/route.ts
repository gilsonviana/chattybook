import { NextResponse } from 'next/server'
import { ApiError, errorResponse, readBody } from '../../../../../../lib/api'
import { summarizeConversation } from '../../../../../../lib/conversation'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const conversationId = Number(id)
    if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
      throw new ApiError('Invalid conversation ID.', 400)
    }
    const { model } = await readBody(request)
    if (model !== undefined && (typeof model !== 'string' || !model.trim())) {
      throw new ApiError('Summary model must be a nonempty string.', 400)
    }
    return NextResponse.json(await summarizeConversation(conversationId, typeof model === 'string' ? model.trim() : undefined))
  } catch (error) {
    return errorResponse(error)
  }
}
