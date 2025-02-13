import { SlackService } from '../slack.service'
import axios from 'axios'
import { BaseLogger } from '@motiadev/core'

jest.mock('axios')
jest.mock('@motiadev/core')

describe('SlackService', () => {
  let slackService: SlackService
  const mockWebhookUrl = 'https://hooks.slack.com/test'
  let mockLogger: jest.Mocked<BaseLogger>

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
    } as any
    ;(BaseLogger as jest.MockedClass<typeof BaseLogger>).mockImplementation(() => mockLogger)

    slackService = new SlackService(mockWebhookUrl)
    ;(axios.post as jest.Mock).mockClear()
  })

  describe('sendMessage', () => {
    it('should send a message successfully', async () => {
      ;(axios.post as jest.Mock).mockResolvedValue({ data: 'ok' })

      await slackService.sendMessage('#test-channel', 'Test message')

      expect(axios.post).toHaveBeenCalledWith(mockWebhookUrl, {
        channel: '#test-channel',
        text: 'Test message',
      })
    })

    it('should handle network errors', async () => {
      const mockError = new Error('Network error')
      ;(axios.post as jest.Mock).mockRejectedValue(mockError)

      await expect(slackService.sendMessage('#test-channel', 'Test message')).rejects.toThrow('Network error')
      expect(mockLogger.error).toHaveBeenCalledWith('Error sending Slack message', mockError)
    })
  })
})
