import { z } from 'zod'
import { ApiRouteConfig, FlowContext, ApiRequest } from '@motiadev/core'
import { TrelloCardDetails } from '../types/trello'
import { TrelloService } from '../services/trello.service'
import { appConfig } from '../config/default'

type TrelloActionType = 'createCard' | 'updateCard' | 'commentCard' | 'addMemberToCard' | 'updateCustomFieldItem'

const inputSchema = z.object({
  action: z.object({
    type: z.enum(['createCard', 'updateCard', 'commentCard', 'addMemberToCard', 'updateCustomFieldItem']),
    data: z.object({
      card: z.object({
        id: z.string(),
      }),
      text: z.string().optional(),
      list: z.object({
        id: z.string(),
      }).optional(),
    }),
    display: z.object({
      entities: z.object({
        memberCreator: z.object({
          username: z.string(),
        }),
      }).optional(),
    }).optional(),
  }),
})

type WebhookAction = z.infer<typeof inputSchema>


export const config: ApiRouteConfig = {
  type: 'api',
  name: 'Trello Webhook Handler',
  description: 'Handles incoming Trello webhook events',
  path: '/trello/webhook',
  method: 'POST',
  emits: [
    { type: 'card.created', label: 'Card Created' },
    { type: 'card.updateCustomFieldItem', label: 'Card Custom Field Updated' },
    { type: 'card.commented', label: 'Card Comment Added' },
    { type: 'member.assigned', label: 'Member Assigned to Card' },
  ],
  virtualSubscribes: ['api.trello.webhook'],
  bodySchema: inputSchema,
  flows: ['trello'],
}

export const handler = async (request: ApiRequest, context: FlowContext) => {
  const payload = inputSchema.parse(request.body)

  const handlers: Record<TrelloActionType, (card: TrelloCardDetails, context: FlowContext, action: WebhookAction) => void> = {
    createCard: handleCreateCard,
    updateCard: () => {},
    updateCustomFieldItem: handleCustomFieldUpdate,
    addMemberToCard: handleMemberAssignment,
    commentCard: handleCardComment,
  }

  const trelloService = new TrelloService(appConfig.trello)
  const card = await trelloService.getCard(payload.action.data.card.id)

  const handler = handlers[payload.action.type]
  handler(card, context, payload)

  return {
    status: 200,
    body: { message: 'Webhook processed successfully' },
  }
}

const handleCreateCard = (card: TrelloCardDetails, context: FlowContext) => {
  context.emit({
    type: 'card.created',
    data: {
      id: card.id,
      name: card.name,
      desc: card.desc,
      members: card.members.map((member) => member.id),
      list: card.idList,
    },
  })
}

const handleCustomFieldUpdate = (card: TrelloCardDetails, context: FlowContext) => {
  context.emit({
    type: 'card.updateCustomFieldItem',
    data: {
      id: card.id,
      customFieldItem: card.customFieldItems?.[0],
    },
  })
}

const handleMemberAssignment = (card: TrelloCardDetails, context: FlowContext) => {
  context.emit({
    type: 'member.assigned',
    data: {
      id: card.id,
    },
  })
}

const handleCardComment = (card: TrelloCardDetails, context: FlowContext, {action}: WebhookAction) => {
  context.emit({
    type: 'card.commented',
    data: {
      card: {
        id: card.id,
        list: action.data.list,
      },
      comment: {
        text: action?.data?.text || '',
        idMember: action?.display?.entities?.memberCreator.username,
      },
    },
  })
}