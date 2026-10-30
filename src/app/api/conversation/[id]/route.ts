import { NextResponse } from 'next/server'
import { ApiError, errorResponse } from '../../../../../lib/api'
import { prisma } from '../../../../../lib/db'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const conversationId = Number(id)
    if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
      throw new ApiError('Invalid conversation ID.', 400)
    }
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { id: 'asc' } } },
    })
    if (!conversation) throw new ApiError('Conversation not found.', 404)
    return NextResponse.json(conversation)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const conversationId = Number(id)
    if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
      throw new ApiError('Invalid conversation ID.', 400)
    }

    const deleted = await prisma.conversation.deleteMany({
      where: { id: conversationId, status: { not: 'generating' } },
    })
    if (deleted.count === 0) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      })
      if (!conversation) throw new ApiError('Conversation not found.', 404)
      throw new ApiError('Cannot delete a conversation while a response is being generated.', 409)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
