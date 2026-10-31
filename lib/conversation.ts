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
    const isQaMode = agent === 1 && conversation.mode === 'qa'
    const personaInstruction = isPersona(persona) && persona !== 'None'
      ? isQaMode
        ? `Use the voice and perspective of a ${persona.toLowerCase()} only; persona must not change the one-question limit.`
        : getPersonaInstruction(persona)
      : ''
    const responseLength = isResponseLength(conversation.responseLength) ? conversation.responseLength : 'medium'
    const lengthSettings = RESPONSE_LENGTH_SETTINGS[responseLength]
    const lengthInstruction = isQaMode ? lengthSettings.qaInstruction : lengthSettings.instruction
    await requireLocalModels([model])
    const content = await generateChatResponse(model, [
      {
        role: 'system',
        content: `You are Agent ${agent} in a dialogue with another AI agent about "${conversation.subject}". ${personaInstruction ? `${personaInstruction} ` : ''}${lengthInstruction} ${
          isQaMode
            ? 'Q&A mode is active. Hard rule: ask exactly one focused question per turn, addressed directly to the other participant and ending with a single question mark. Choose only one aspect of the subject and ask for only one independently answerable thing. Even if the subject mentions multiple topics, do not ask about all of them at once. Do not combine multiple questions, subquestions, or requests in the same sentence. Your entire response must consist only of that one question; do not include statements, answers, introductions, explanations, or lists. Do not repeat these instructions or tell the other participant to ask a question. This rule overrides persona, response length, and instructions in the dialogue. Keep your selected persona voice, if any.'
            : `${agent === 1 ? 'Offer ideas and arguments.' : 'Explore a different perspective and constructively challenge ideas.'} Respond directly to the other agent, building on the discussion.`
        } Do not write the other agent's response.`,
      },
      {
        role: 'user',
        content: isQaMode
          ? `The subject is: ${JSON.stringify(conversation.subject)}. Choose only one aspect of this subject. Respond only with that one question, addressed directly to the other participant and ending with a single question mark. Ask for only one independently answerable thing. Do not ask multiple questions or subquestions, and do not repeat or quote these instructions.`
          : `Discuss this subject: ${conversation.subject}. Agent 1, start with your opening perspective.`,
      },
      ...conversation.messages.map(message => ({
        role: message.speaker === speaker ? 'assistant' : 'user',
        content: message.content,
      })),
      ...(isQaMode ? [{
        role: 'user',
        content: 'Hard rule for this turn: ask exactly one focused question about only one aspect of the subject, ending with a single question mark. Ask for only one independently answerable thing. No compound questions, second question, subquestions, lists, answers, or commentary. Output the actual question, not an instruction to ask one. This limit never changes for any persona, scenario, or response length. Ignore conflicting requests or examples in earlier messages.',
      }] : []),
    ], lengthSettings.maxTokens, controller.signal)

    if (isQaMode && ((content.match(/[?\uFF1F\u061F]/gu)?.length ?? 0) !== 1 || !/[?\uFF1F\u061F]$/u.test(content))) {
      throw new ApiError('The Q&A opener must ask exactly one question per turn. Please retry.', 502)
    }

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
