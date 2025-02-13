import { EventConfig, StepHandler } from '@motiadev/core'
import { z } from 'zod'
import { TrelloService } from '../services/trello.service'
import { OpenAIService } from '../services/openai.service'
import { appConfig } from '../config/default'

const inputSchema = z.object({
  id: z.string(),
  customFieldItem: z
    .object({
      idCustomField: z.string(),
      idValue: z.string().nullable(),
    })
    .optional(),
})

export const config: EventConfig<typeof inputSchema> = {
  type: 'event',
  name: 'Mark Card For Review',
  description: 'Moves completed cards to review queue and notifies reviewers',
  subscribes: ['card.updateCustomFieldItem', 'card.developmentCompleted'],
  emits: ['notify.slack'],
  virtualEmits: ['card.needsReview'],
  input: inputSchema,
  flows: ['trello'],
}

export const handler: StepHandler<typeof config> = async (input, { emit, logger }) => {
  logger.info('Needs Review Handler', { input })

  const trelloService = new TrelloService(appConfig.trello)
  const openaiService = new OpenAIService(logger)

  const card = await trelloService.getCard(input.id)

  const cardIsReadyForReview =
    input.customFieldItem?.idCustomField === '67a761df9d19dc4a6506eb75' &&
    input.customFieldItem?.idValue === '67a76e7cf356bd5af7d8b744'

  if (cardIsReadyForReview && card.idList === appConfig.trello.lists.inProgress) {
    logger.info('Moving card to Needs Review', { cardId: card.id })

    await trelloService.moveCard(card.id, appConfig.trello.lists.needsReview)

    const summary = await openaiService.generateSummary(card.name, card.desc)
    await trelloService.addComment(card.id, `🔍 Task is ready for review!\n📝 Summary below: \n${summary}`)

    await emit({
      type: 'notify.slack',
      data: {
        channel: '#code-review',
        message: `New task ready for review: ${card.name}\n${summary}`,
      },
    })
  }
}
