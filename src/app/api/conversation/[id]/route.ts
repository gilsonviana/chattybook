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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const conversationId = Number(id)
    if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
      throw new ApiError('Invalid conversation ID.', 400)
    }

    const rawBody = await request.text()
    if (rawBody.trim()) {
      let body: unknown
      try {
        body = JSON.parse(rawBody)
      } catch {
        throw new ApiError('Request body must be valid JSON.', 400)
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ApiError('Request body must be a JSON object.', 400)
      }
      const { title } = body as Record<string, unknown>
      if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) {
        throw new ApiError('Title must contain between 1 and 120 characters.', 400)
      }

      const renamed = await prisma.conversation.updateMany({
        where: { id: conversationId, status: 'completed' },
        data: { title: title.trim() },
      })
      if (renamed.count === 0) {
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { id: true },
        })
        if (!conversation) throw new ApiError('Conversation not found.', 404)
        throw new ApiError('Cannot rename a conversation until it is completed.', 409)
      }
      return NextResponse.json({ success: true, title: title.trim() })
    }

    const cancelled = await prisma.conversation.updateMany({
      where: { id: conversationId },
      data: { status: 'completed' },
    })
    if (cancelled.count === 0) throw new ApiError('Conversation not found.', 404)
    return NextResponse.json({ success: true, status: 'completed' })
  } catch (error) {
    return errorResponse(error)
  }
}
