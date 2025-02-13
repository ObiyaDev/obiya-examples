import { Logger, FlowContext, InternalStateManager } from '@motiadev/core'

export const createMockLogger = () => {
  const mockLogger = new Logger('test-trace-id', ['test-flow'], 'test-file') as jest.Mocked<Logger>
  return mockLogger
}

export const setupLoggerMock = () => {
  ;(Logger as jest.MockedClass<typeof Logger>).mockImplementation(
    () => ({ info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn() }) as any,
  )
}

export const createMockContext = (logger = createMockLogger(), emit = jest.fn()): FlowContext => {
  return {
    logger,
    emit,
    traceId: 'test-trace-id',
    state: {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
    } as InternalStateManager,
  }
}
