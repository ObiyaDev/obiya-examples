import { ApiRouteConfig, StepHandler } from 'motia';
import { z } from 'zod';

// Define request body schema with zod
const bodySchema = z.object({
  repository: z.string().min(1),
  branch: z.string().optional(),
  requirements: z.string().min(1)
});

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ReviewRequest',
  description: 'API endpoint to initiate the code review process',
  path: '/api/review',
  method: 'POST',
  emits: ['review.requested'],
  flows: ['code-review-flow'],
  bodySchema
};

export const handler: StepHandler<typeof config> = async (req, { emit, logger }) => {
  logger.info('Review requested via API', { body: req.body });

  // Extract data from request body and ensure branch has a default value
  const { repository, requirements } = req.body;
  const branch = req.body.branch || 'main';

  // Emit review.requested event
  await emit({
    topic: 'review.requested',
    data: {
      repository,
      branch,
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
      timestamp: new Date().toISOString()
    },
  };
}; 