import { z } from 'zod';
import { EventConfig, StepHandler } from '@motiadev/core';
import { Commits } from '../shared/utils/repository';
import { evaluateCommits } from '../shared/agents/claude';

const mctsControllerInputSchema = z.object({
  prompt: z.string(),
  repoUrl: z.string(),
  branch: z.string(),
  maxIterations: z.number().default(100),
  explorationConstant: z.number().default(1.414),
  maxDepth: z.number().default(10),
  reviewStartCommit: z.string().optional(),
  reviewEndCommit: z.string().optional(),
  requirements: z.string()
});
export type MCTSControllerInput = z.infer<typeof mctsControllerInputSchema>;

export const mctsControllerConfig: EventConfig = {
  type: 'event',
  name: 'MCTSController',
  description: 'Controls the MCTS process for code review reasoning',
  subscribes: ['review.requested', 'mcts.backpropagation.completed'],
  emits: ['mcts.iteration.started', 'mcts.iterations.completed'],
  flows: ['code-review-flow'],
  input: mctsControllerInputSchema
};

export const handler: StepHandler<typeof mctsControllerConfig> = async (input: MCTSControllerInput, { emit, logger, state, traceId }) => {
    logger.info('Analyzing review context', {
      ...input,
      requirements: input.requirements.length > 20
        ? `${input.requirements.slice(0, 20)}...`
        : input.requirements
    });
   
    const commits = await Commits.create(traceId, state, input);
    const evaluation = await evaluateCommits(commits, input.prompt);
  
    if (evaluation.score > 0.9 || input.maxIterations === 0) {
      await emit({
        topic: 'mcts.iterations.completed',
        data: evaluation
      });
      logger.info('Context analysis completed');
    } else {
      await emit({
        topic: 'mcts.iteration.started',
        data: evaluation
      });
    }
};
