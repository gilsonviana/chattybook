import { NextResponse } from 'next/server'
import { errorResponse, readBody } from '../../../../lib/api'
import { initializeConversation, parseConversationConfig } from '../../../../lib/conversation'
import { parseForkSummary, parseTopics } from '../../../../lib/topic-planner'
import { prisma } from '../../../../lib/db'

export async function GET() {
  try {
    const conversations = await prisma.conversation.findMany({
      select: {
        id: true,
        subject: true,
        title: true,
        status: true,
        persona1: true,
        persona2: true,
        responseLength: true,
        devilsAdvocate: true,
        forkedFromId: true,
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
    const body = await readBody(request)
    const options = parseConversationConfig(body)
    const topics = body.topics === undefined ? undefined : parseTopics(body.topics, options.totalTurns, options.subject)
    const forkSummary = options.forkedFromId === null ? undefined : parseForkSummary(body.forkSummary)
    const conversation = await initializeConversation(options, { topics, forkSummary })
    return NextResponse.json(conversation, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
