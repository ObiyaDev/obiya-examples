import { EventConfig, StepHandler } from 'motia';
import { z } from 'zod';


const inputSchema = z.object({
  protocol: z.string(),
  host: z.string().optional(),
  owner: z.string().optional(),
  repo: z.string(),
  branch: z.string(),
  depth: z.number().nonnegative(),
  reviewStartCommit: z.string().optional(),
  reviewEndCommit: z.string().optional(),
  requirements: z.string(),
  timestamp: z.string()
});
type Input = z.infer<typeof inputSchema>;

export const config: EventConfig = {
  type: 'event',
  name: 'Analyze',
  description: 'Analyzes the context for code review',
  subscribes: ['review.requested'],
  emits: ['review.problemFound', 'review.planPart'],
  flows: ['code-review-flow'],
  input: inputSchema
};

export const handler: StepHandler<typeof config> = async (input: Input, { emit, logger, state, traceId }) => {
  logger.info('Analyzing review context', {
    ...input,
    requirements: input.requirements.length > 20
      ? `${input.requirements.slice(0, 20)}...`
      : input.requirements
  });

  try {
    const { commitLog, diffs } = await getChangeHistory(input);

    // Store request details in state for later steps
    await state.set(traceId, 'reviewRequest', input);

    // Mock analysis: emit a problem found event
    await emit({
      topic: 'review.problemFound',
      data: {
        problem: `Potential issues in repository: ${input.repository}`,
        severity: 'medium',
        area: 'performance',
        timestamp: new Date().toISOString()
      }
    });

    // Mock analysis: emit a plan part event
    await emit({
      topic: 'review.planPart',
      data: {
        part: `Analyze performance in ${input.repository}`,
        priority: 1,
        timestamp: new Date().toISOString()
      }
    });

    logger.info('Context analysis completed');
  } catch (error) {
    logger.error('Error analyzing context', { error: error instanceof Error ? error.message : String(error) });

    // Emit error as a plan part for visibility
    await emit({
      topic: 'review.planPart',
      data: {
        part: 'Error occurred during context analysis',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    });
  }
}; 