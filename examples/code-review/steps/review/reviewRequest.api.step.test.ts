import { handler, config } from './reviewRequest.api.step';

// Mock the ApiRequest type from Motia
interface MockApiRequest {
  body: any;
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
  headers: Record<string, string>;
}

// Mock the Motia context
const createTestContext = () => ({
  emit: jest.fn(),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  state: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn()
  },
  traceId: 'test-trace-id'
});

// Mock Date.now() to return a fixed timestamp
const originalDateNow = Date.now;
const originalDateToISOString = Date.prototype.toISOString;

describe('Review Request API Step', () => {
  beforeAll(() => {
    // Mock Date.now() and toISOString for predictable testing
    const mockNow = jest.fn(() => 1620000000000); // Fixed timestamp
    Date.now = mockNow;
    const mockToISOString = jest.fn(() => '2021-05-03T00:00:00.000Z');
    Date.prototype.toISOString = mockToISOString;
  });

  afterAll(() => {
    // Restore original Date functionality
    Date.now = originalDateNow;
    Date.prototype.toISOString = originalDateToISOString;
  });

  it('should have proper configuration', () => {
    expect(config.type).toBe('api');
    expect(config.name).toBe('ReviewRequest');
    expect(config.path).toBe('/api/review');
    expect(config.method).toBe('POST');
    expect(config.emits).toContain('review.requested');
    expect(config.flows).toContain('code-review-flow');
  });

  it('should emit review.requested event with request data', async () => {
    // Arrange
    const context = createTestContext();
    const req: MockApiRequest = {
      body: {
        repository: 'testuser/testrepo',
        branch: 'main',
        requirements: 'Test requirements'
      },
      pathParams: {},
      queryParams: {},
      headers: {}
    };

    // Act
    const result = await handler(req as any, context as any);

    // Assert
    expect(context.emit).toHaveBeenCalledWith({
      topic: 'review.requested',
      data: {
        repository: 'testuser/testrepo',
        branch: 'main',
        requirements: 'Test requirements',
        timestamp: '2021-05-03T00:00:00.000Z'
      }
    });
    
    expect(result).toEqual({
      status: 200,
      body: {
        message: 'Code review process initiated',
        repository: 'testuser/testrepo',
        branch: 'main',
        timestamp: '2021-05-03T00:00:00.000Z'
      }
    });
  });

  it('should use default branch if not provided', async () => {
    // Arrange
    const context = createTestContext();
    const req: MockApiRequest = {
      body: {
        repository: 'testuser/testrepo',
        requirements: 'Test requirements'
      },
      pathParams: {},
      queryParams: {},
      headers: {}
    };

    // Act
    const result = await handler(req as any, context as any);

    // Assert
    // Check that the response includes the default branch
    expect(result.body).toHaveProperty('branch', 'main');
    
    // Check that we made a call to emit
    expect(context.emit).toHaveBeenCalled();
    
    // Extract the call arguments to verify specific properties
    const emitCall = context.emit.mock.calls[0][0];
    expect(emitCall.topic).toBe('review.requested');
    expect(emitCall.data.repository).toBe('testuser/testrepo');
    expect(emitCall.data.requirements).toBe('Test requirements');
  });
}); 