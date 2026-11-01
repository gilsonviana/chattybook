import { NextResponse } from 'next/server'
import { ApiError, errorResponse, readBody } from '../../../../../../lib/api'
import { updateTopics } from '../../../../../../lib/topics'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const conversationId = Number(id)
    if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
      throw new ApiError('Invalid conversation ID.', 400)
    }
    const { model, reset } = await readBody(request)
    if (model !== undefined && (typeof model !== 'string' || !model.trim())) {
      throw new ApiError('Topic model must be a nonempty string.', 400)
    }
    if (reset !== undefined && typeof reset !== 'boolean') {
      throw new ApiError('Reset must be a boolean.', 400)
    }
    if (reset && model === undefined) {
      throw new ApiError('Refreshing topics requires a model.', 400)
    }
    return NextResponse.json(await updateTopics(conversationId, typeof model === 'string' ? model.trim() : undefined, reset === true))
  } catch (error) {
    return errorResponse(error)
  }
}
