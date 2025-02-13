import { EventConfig, StepHandler } from '@motiadev/core'
import { z } from 'zod'
import { TrelloService } from '../services/trello.service'
import { appConfig } from '../config/default'

const inputSchema = z.object({
  id: z.string(),
})

export const config: EventConfig<typeof inputSchema> = {
  type: 'event',
  name: 'Start Assigned Card',
  description: 'Moves newly assigned cards to the in-progress state',
  subscribes: ['member.assigned', 'card.readyForDevelopment'],
  virtualEmits: ['card.inProgress'],
  emits: [''],
  input: inputSchema,
  flows: ['trello'],
}

export const handler: StepHandler<typeof config> = async (payload, { logger }) => {
  try {
    logger.info('Start Assigned Card Handler', { payload })
    const trelloService = new TrelloService(appConfig.trello)
    const card = await trelloService.getCard(payload.id)

    if (card.idList === appConfig.trello.lists.newTasks && card.members.length > 0) {
      const [firstMember] = card.members

      logger.info('Moving card to In Progress', {
        cardId: card.id,
        member: firstMember.fullName,
      })

      await trelloService.moveCard(card.id, appConfig.trello.lists.inProgress)

      await trelloService.addComment(
        card.id,
        `🚀 Card has been assigned to **${firstMember.fullName}** and moved to In Progress!`,
      )
    }
  } catch (error) {
    logger.error('Error in Task Progress Handler', error)
  }
}
