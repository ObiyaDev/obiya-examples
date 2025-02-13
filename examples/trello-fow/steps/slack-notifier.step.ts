import { EventConfig, StepHandler } from '@motiadev/core'
import { z } from 'zod'
import { SlackService } from '../services/slack.service'
import { appConfig } from '../config/default'

const inputSchema = z.object({
  channel: z.string(),
  message: z.string(),
})

export const config: EventConfig<typeof inputSchema> = {
  type: 'event',
  name: 'Slack Notifier',
  description: 'Sends notifications to Slack channels',
  subscribes: ['notify.slack'],
  emits: [],
  input: inputSchema,
  flows: ['trello'],
}

export const handler: StepHandler<typeof config> = async (notification, { logger }) => {
  logger.info('Sending notification to Slack', { notification })
  const slack = new SlackService(appConfig.slack.webhookUrl)
  await slack.sendMessage(notification.channel, notification.message)
}
