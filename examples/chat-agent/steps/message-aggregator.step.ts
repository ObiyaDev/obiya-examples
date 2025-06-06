import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'

export const config: EventConfig = {
  type: 'event',
  name: 'MessageAggregator',
  description: 'Aggregate processed messages and update chat stream',
  subscribes: ['processed-message'],
  emits: [],
  input: z.object({
    type: z.enum(['validation', 'sentiment', 'moderation']),
    messageId: z.string(),
    message: z.string(),
    username: z.string(),
    roomId: z.string(),
    timestamp: z.string(),
    result: z.record(z.any())
  }),
  flows: ['chat'],
}

export const handler: Handlers['MessageAggregator'] = async (input, { traceId, logger, state, streams }) => {
  logger.info('Aggregating message processing result', { 
    messageId: input.messageId, 
    type: input.type 
  })

  const { type, messageId, message, username, roomId, timestamp, result } = input

  const processingKey = `processing-${messageId}`
  const currentProcessing = await state.get(traceId, processingKey) as Record<string, any> || {}
  
  currentProcessing[type] = result
  await state.set(traceId, processingKey, currentProcessing)

  const expectedProcessing = ['validation', 'sentiment', 'moderation']
  const completedProcessing = Object.keys(currentProcessing)
  const isComplete = expectedProcessing.every(key => completedProcessing.includes(key))

  if (isComplete) {
    const validation = currentProcessing.validation
    const sentiment = currentProcessing.sentiment
    const moderation = currentProcessing.moderation

    if (validation.isValid && !moderation.shouldBlock) {
      const currentChat = await streams.chatMessages.get(traceId, roomId) || {
        roomId,
        messages: [],
        totalMessages: 0,
        lastActivity: timestamp
      }

      const newMessage = {
        messageId,
        message: moderation.moderatedMessage || message,
        username,
        timestamp,
        sentiment: sentiment.sentiment,
        isModerated: moderation.isModerated,
        flags: moderation.flags || []
      }

      currentChat.messages.push(newMessage)
      currentChat.totalMessages = currentChat.messages.length
      currentChat.lastActivity = timestamp

      await streams.chatMessages.set(traceId, roomId, currentChat)

      logger.info('Message added to chat', { 
        messageId, 
        roomId,
        totalMessages: currentChat.totalMessages 
      })
    } else {
      logger.info('Message blocked', { 
        messageId, 
        reason: !validation.isValid ? validation.reason : 'Moderation block',
        shouldBlock: moderation.shouldBlock 
      })
    }

    await state.delete(traceId, processingKey)
  } else {
    logger.info('Partial message processing completed', { 
      messageId, 
      completedProcessing 
    })
  }
}
