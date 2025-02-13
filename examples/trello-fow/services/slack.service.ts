import axios from 'axios'
import { BaseLogger } from '@motiadev/core'

export class SlackService {
  private logger: BaseLogger

  constructor(private webhookUrl: string) {
    this.logger = new BaseLogger({ service: 'SlackService' })
  }

  async sendMessage(channel: string, message: string) {
    try {
      await axios.post(this.webhookUrl, {
        channel,
        text: message,
      })
    } catch (error) {
      this.logger.error('Error sending Slack message', error)
      throw error
    }
  }
}
