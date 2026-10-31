import { prisma } from './db'
import { ApiError } from './api'
import { generateChatResponse, requireLocalModels } from './ollama'
import type { ConversationMode } from './conversation-mode'
import { getPersonaInstruction, isPersona, type Persona } from './personas'
import { isResponseLength, RESPONSE_LENGTH_SETTINGS, type ResponseLength } from './response-length'

export interface ConversationOptions {
  subject: string
  model1: string
  model2: string
  persona1: Persona
  persona2: Persona
  mode: ConversationMode
  responseLength: ResponseLength
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

  const controller = new AbortController()
  const cancellationCheck = setInterval(() => {
    void prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { status: true },
    }).then(current => {
      if (current?.status !== 'generating') controller.abort()
    }).catch(() => controller.abort())
  }, 100)

  try {
    const agent = count % 2 === 0 ? 1 : 2
    const speaker = agent === 1 ? 'agent1' : 'agent2'
    const model = agent === 1 ? conversation.model1 : conversation.model2
    const persona = agent === 1 ? conversation.persona1 : conversation.persona2
    const personaInstruction = isPersona(persona) ? getPersonaInstruction(persona) : ''
    const isQaMode = agent === 1 && conversation.mode === 'qa'
    const responseLength = isResponseLength(conversation.responseLength) ? conversation.responseLength : 'medium'
    const lengthSettings = RESPONSE_LENGTH_SETTINGS[responseLength]
    const lengthInstruction = isQaMode ? lengthSettings.qaInstruction : lengthSettings.instruction
    await requireLocalModels([model])
    const content = await generateChatResponse(model, [
      {
        role: 'system',
        content: `You are Agent ${agent} in a dialogue with another AI agent about "${conversation.subject}". ${personaInstruction ? `${personaInstruction} ` : ''}${lengthInstruction} ${
          isQaMode
            ? 'Q&A mode is active. Ask Agent 2 concise, relevant questions about the subject. Your entire response must consist only of questions; do not include statements, answers, introductions, or explanations. Keep your selected persona voice, if any.'
            : `${agent === 1 ? 'Offer ideas and arguments.' : 'Explore a different perspective and constructively challenge ideas.'} Respond directly to the other agent, building on the discussion.`
        } Do not write the other agent's response.`,
      },
      {
        role: 'user',
        content: isQaMode
          ? `Ask Agent 2 one or more concise questions about this subject: ${conversation.subject}. Respond only with questions.`
          : `Discuss this subject: ${conversation.subject}. Agent 1, start with your opening perspective.`,
      },
      ...conversation.messages.map(message => ({
        role: message.speaker === speaker ? 'assistant' : 'user',
        content: message.content,
      })),
    ], lengthSettings.maxTokens, controller.signal)

    return await prisma.$transaction(async tx => {
      const completed = count + 1 === conversation.totalTurns * 2
      const updated = await tx.conversation.updateMany({
        where: { id: conversationId, status: 'generating' },
        data: { status: completed ? 'completed' : 'active' },
      })
      if (updated.count !== 1) throw new ApiError('Conversation generation was cancelled.', 409)
      await tx.message.create({
        data: {
          conversationId, speaker, role: 'assistant', content,
          turnNumber: Math.floor(count / 2) + 1,
        },
      })
      const allMessages = await tx.message.findMany({
        where: { conversationId },
        orderBy: { id: 'asc' },
      })
      return { success: true, message: content, allMessages, completed }
    })
  } catch (error) {
    await prisma.conversation.updateMany({
      where: { id: conversationId, status: 'generating' },
      data: { status: 'active' },
    })
    if (controller.signal.aborted) throw new ApiError('Conversation generation was cancelled.', 409)
    throw error
  } finally {
    clearInterval(cancellationCheck)
  }
}
