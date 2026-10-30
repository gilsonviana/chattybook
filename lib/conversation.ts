import { prisma } from './db'
import { ApiError } from './api'
import { generateChatResponse, requireLocalModels } from './ollama'

export interface ConversationOptions {
  subject: string
  model1: string
  model2: string
  totalTurns: number
}

export async function initializeConversation(options: ConversationOptions) {
  await requireLocalModels([options.model1, options.model2])
  return prisma.conversation.create({
    data: options,
    include: { messages: true },
  })
}

export async function runNextTurn(conversationId: number, expectedMessageCount: number) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { id: 'asc' } } },
  })
  if (!conversation) throw new ApiError('Conversation not found.', 404)
  if (conversation.status !== 'active') {
    throw new ApiError(conversation.status === 'completed'
      ? 'This conversation is already completed.'
      : 'A response is already being generated.', 409)
  }
  const count = conversation.messages.length
  if (count !== expectedMessageCount) {
    throw new ApiError('Conversation has changed. Reload its messages before continuing.', 409)
  }
  if (count >= conversation.totalTurns * 2) {
    throw new ApiError('All turns have already been generated.', 409)
  }

  const lock = await prisma.conversation.updateMany({
    where: { id: conversationId, status: 'active', updatedAt: conversation.updatedAt },
    data: { status: 'generating' },
  })
  if (lock.count !== 1) throw new ApiError('A response is already being generated.', 409)

  try {
    const agent = count % 2 === 0 ? 1 : 2
    const speaker = agent === 1 ? 'agent1' : 'agent2'
    const model = agent === 1 ? conversation.model1 : conversation.model2
    await requireLocalModels([model])
    const content = await generateChatResponse(model, [
      {
        role: 'system',
        content: `You are Agent ${agent} in a dialogue with another AI agent about "${conversation.subject}". ${
          agent === 1 ? 'Offer ideas and arguments.' : 'Explore a different perspective and constructively challenge ideas.'
        } Respond directly to the other agent, building on the discussion. Keep each response to one or two short paragraphs. Do not write the other agent's response.`,
      },
      { role: 'user', content: `Discuss this subject: ${conversation.subject}. Agent 1, start with your opening perspective.` },
      ...conversation.messages.map(message => ({
        role: message.speaker === speaker ? 'assistant' : 'user',
        content: message.content,
      })),
    ])

    return await prisma.$transaction(async tx => {
      await tx.message.create({
        data: {
          conversationId, speaker, role: 'assistant', content,
          turnNumber: Math.floor(count / 2) + 1,
        },
      })
      const completed = count + 1 === conversation.totalTurns * 2
      await tx.conversation.update({
        where: { id: conversationId },
        data: { status: completed ? 'completed' : 'active' },
      })
      const allMessages = await tx.message.findMany({
        where: { conversationId },
        orderBy: { id: 'asc' },
      })
      return { success: true, message: content, allMessages, completed }
    })
  } catch (error) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'active' },
    })
    throw error
  }
}
