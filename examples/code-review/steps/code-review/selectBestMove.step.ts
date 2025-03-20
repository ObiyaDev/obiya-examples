// 5. SelectBestMove activity
import { z } from 'zod';
import { EventConfig, StepHandler } from 'motia';

const selectBestMoveInputSchema = z.object({
  nodes: z.record(z.string(), z.object({
    id: z.string(),
    parent: z.string().nullable(),
    children: z.array(z.string()),
    visits: z.number(),
    value: z.number(),
    state: z.string(),
    isTerminal: z.boolean()
  })),
  rootId: z.string(),
  currentIteration: z.number(),
  maxIterations: z.number(),
  explorationConstant: z.number(),
  maxDepth: z.number()
});

export type SelectBestMoveInput = z.infer<typeof selectBestMoveInputSchema>;

export const config: EventConfig = {
  type: 'event',
  name: 'SelectBestMove',
  description: 'Selects the best reasoning path after MCTS iterations',
  subscribes: ['mcts.iterations.completed'],
  emits: ['code-review.reasoning.completed'],
  flows: ['code-review-flow'],
  input: selectBestMoveInputSchema
};

export const handler: StepHandler<typeof config> = async (input: SelectBestMoveInput, { emit, logger, state, traceId }) => {
  const bestNode = findBestNode(input.nodes, input.rootId);
  await emit({
    topic: 'code-review.reasoning.completed',
    data: bestNode.state
  });
};

function findBestNode(nodes: Record<string, any>, rootId: string) {
  let bestNode = nodes[rootId];
  let bestValue = bestNode.value;
  
  for (const nodeId in nodes) {
    if (nodes[nodeId].value > bestValue) {
      bestNode = nodes[nodeId];
      bestValue = nodes[nodeId].value;
    }
  }
  return bestNode;
}