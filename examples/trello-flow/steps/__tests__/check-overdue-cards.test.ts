import { FlowContext, Logger } from '@motiadev/core'
import { TrelloService } from '../../services/trello.service'
import { handler } from '../check-overdue-cards.step'
import { createMockLogger, createMockContext } from '../../test/test-helpers'

jest.mock('@motiadev/core')
jest.mock('../../services/trello.service')

describe('Check Overdue Cards', () => {
  let mockLogger: jest.Mocked<Logger>
  let mockContext: FlowContext
  let mockGetCardsInList: jest.Mock
  let mockAddComment: jest.Mock

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockContext = createMockContext(mockLogger)
    mockGetCardsInList = jest.fn()
    mockAddComment = jest.fn()

    ;(TrelloService as jest.Mock).mockImplementation(() => ({
      getCardsInList: mockGetCardsInList,
      addComment: mockAddComment,
    }))

    jest.clearAllMocks()
  })

  it('should identify and comment on overdue cards', async () => {
    const overdueCard = {
      id: 'card-123',
      name: 'Overdue Card',
      due: '2023-01-01T00:00:00.000Z',
    }

    mockGetCardsInList.mockResolvedValue([overdueCard])

    await handler(mockContext)

    expect(mockAddComment).toHaveBeenCalledWith(
      'card-123',
      '⚠️ OVERDUE: This card has passed its due date!'
    )
  })

  it('should not comment on cards without due date', async () => {
    const cardWithoutDue = {
      id: 'card-123',
      name: 'Normal Card',
      due: null,
    }

    mockGetCardsInList.mockResolvedValue([cardWithoutDue])

    await handler(mockContext)

    expect(mockAddComment).not.toHaveBeenCalled()
  })
}) 