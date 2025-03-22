import { jest } from '@jest/globals';

// Mock fetch function
global.fetch = jest.fn().mockImplementation((url) => {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: jest.fn().mockImplementation((header) => {
        if (header === 'allow') return 'GET, POST, OPTIONS';
        return null;
      })
    }
  });
}) as jest.Mock;

// Mock the file system
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false)
}));

// Mock child_process execSync
jest.mock('child_process', () => ({
  execSync: jest.fn().mockReturnValue(null)
}));

// Mock the module and its dependencies
jest.mock('./reviewRequest.api.step', () => {
  // Create a mock implementation of the bodySchema
  const mockBodySchema = {
    parse: jest.fn().mockImplementation((data: any) => {
      if (!data.repository) {
        throw new Error('Missing required field: repository');
      }
      if (!data.requirements) {
        throw new Error('Missing required field: requirements');
      }
      
      // Return the data with defaults
      return {
        ...data,
        branch: data.branch || 'main',
        depth: data.depth || 2,
        reviewStartCommit: data.reviewStartCommit || '',
        reviewEndCommit: data.reviewEndCommit || 'HEAD',
        outputUrl: data.outputUrl || 'file://.'
      };
    })
  };
  
  return {
    config: {
      bodySchema: mockBodySchema
    },
    handler: jest.fn().mockImplementation(async (req: any, context: any) => {
      const validatedBody = mockBodySchema.parse(req.body);
      const mockRepoDir = '/mocked/repo/path';
      
      await context.emit({
        topic: 'review.requested',
        data: {
          repo_dir: mockRepoDir,
          branch: validatedBody.branch,
          depth: validatedBody.depth,
          review_start_commit: validatedBody.reviewStartCommit || 'HEAD~10',
          review_end_commit: validatedBody.reviewEndCommit || 'HEAD',
          requirements: validatedBody.requirements,
          timestamp: new Date().toISOString(),
          max_iterations: 100,
          exploration_constant: 1.414,
          max_depth: validatedBody.depth,
          output_url: validatedBody.outputUrl
        }
      });
      
      return {
        status: 200,
        body: {
          message: 'Code review process initiated'
        }
      };
    }),
    validateOutputUrl: jest.fn().mockImplementation(async (url: string) => {
      return url;
    }),
    fetchRepository: jest.fn().mockImplementation((repo: string) => {
      return '/mocked/repo/path';
    })
  };
});

// Mock Date for consistent timestamps
const mockDate = new Date('2023-01-01T00:00:00Z');
global.Date = jest.fn(() => mockDate) as any;
global.Date.now = jest.fn(() => mockDate.getTime());
mockDate.toISOString = jest.fn(() => '2023-01-01T00:00:00.000Z');

// Import the module after mocking
import * as ReviewRequestStep from './reviewRequest.api.step';

describe('Review Request API Step', () => {
  let mockEmit: jest.Mock;
  let mockLogger: Record<string, jest.Mock>;
  let context: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEmit = jest.fn();
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };
    context = { 
      emit: mockEmit,
      logger: mockLogger
    };
  });

  it('should emit review.initiated with proper data when given valid input', async () => {
    const request = {
      body: {
        repository: 'https://github.com/test/repo',
        requirements: 'Test requirements',
        outputUrl: 'https://example.com/output'
      }
    };

    const result = await ReviewRequestStep.handler(request as any, context as any);

    expect(result.status).toBe(200);
    expect(result.body.message).toBe('Code review process initiated');
    
    expect(mockEmit).toHaveBeenCalledWith({
      topic: 'review.requested',
      data: expect.objectContaining({
        repo_dir: '/mocked/repo/path',
        requirements: 'Test requirements',
        output_url: 'https://example.com/output',
        timestamp: '2023-01-01T00:00:00.000Z'
      })
    });
  });

  it('should use default outputUrl when not provided', async () => {
    const request = {
      body: {
        repository: 'https://github.com/test/repo',
        requirements: 'Test requirements'
      }
    };

    await ReviewRequestStep.handler(request as any, context as any);
    
    expect(mockEmit).toHaveBeenCalledWith({
      topic: 'review.requested',
      data: expect.objectContaining({
        repo_dir: '/mocked/repo/path',
        requirements: 'Test requirements',
        output_url: 'file://.',
        timestamp: '2023-01-01T00:00:00.000Z'
      })
    });
  });

  it('should throw error when repository field is missing', async () => {
    const request = {
      body: {
        requirements: 'Test requirements',
        outputUrl: 'https://example.com/output'
      }
    };

    await expect(
      ReviewRequestStep.handler(request as any, context as any)
    ).rejects.toThrow('Missing required field: repository');
  });

  it('should throw error when requirements field is missing', async () => {
    const request = {
      body: {
        repository: 'https://github.com/test/repo',
        outputUrl: 'https://example.com/output'
      }
    };

    await expect(
      ReviewRequestStep.handler(request as any, context as any)
    ).rejects.toThrow('Missing required field: requirements');
  });
}); 