import { ApiRouteConfig, StepHandler } from 'motia';
import { z } from 'zod';
import { parseRepoUrl } from '../shared/utils/repository';

const bodySchema = z.object({
  repository: z.string().min(1).describe('The repository to review. Should be a valid git repository of format: [<protocol>://][<host>/][<owner>]/[<repo>], e.g. https://github.com/buger/probe.git'),
  branch: z.string().optional().default('main').describe('The branch to review. Defaults to main.'),
  depth: z.number().nonnegative().optional().default(2).describe('The depth of the review to perform, defaults to 2. Depth is the number of abstraction layers the AI will reason about during the review.'),
  reviewStartCommit: z.string().optional().default('').describe('The commit hash to start the review from. Defaults to the oldest commit. Defaults to the oldest commit of the branch if not provided.'),
  reviewMaxCommits: z.number().nonnegative().optional().default(100).describe('The maximum number of commits to review. Defaults to 100.'),
  reviewEndCommit: z.string().optional().default('HEAD').describe('The commit hash to end the review at. Defaults to the latest commit.'),
  requirements: z.string().min(1).optional().default('').describe('The requirements for the code review. Defaults to an empty string.')
});

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ReviewRequest',
  description: 'Initiate a code review process',
  path: '/api/review',
  method: 'POST',
  emits: ['review.requested'],
  flows: ['code-review-flow'],
  bodySchema
};

export const handler: StepHandler<typeof config> = async (req, { emit, logger }) => {
  logger.info('Review requested via API', { body: req.body });
  const { repository, requirements, depth, reviewStartCommit, reviewEndCommit, branch } = req.body;

  try {
    const { protocol, host, owner, repo } = parseRepoUrl(repository);
    await emit({
      topic: 'review.requested',
      data: {
        protocol,
        host,
        owner,
        repo,
        branch,
        depth,
        reviewStartCommit,
        reviewEndCommit,
        requirements,
        timestamp: new Date().toISOString()
      },
    });
    return {
      status: 200,
      body: { 
        message: 'Code review process initiated',
        repository,
        branch,
        depth,
        reviewStartCommit,
        reviewEndCommit,
        requirements,
        timestamp: new Date().toISOString()
      },
    };  
  } catch (error) {
    logger.error('Error handling review request', error);
    await emit({
      topic: 'review.error',
      data: {
        message: 'Invalid repository format',
        repository,
        timestamp: new Date().toISOString()
      }
    });
    return {
      status: 404,
      body: { 
        message: 'Repository not found', 
        repository, 
        timestamp: new Date().toISOString() 
      }
    };
  }
};
