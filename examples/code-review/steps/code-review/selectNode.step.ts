// 1. SelectNode activity
import { z } from 'zod';
import { EventConfig, StepHandler } from 'motia';
import { selectNode, nodeSchema } from '../shared/agents/claude';

const selectNodeInputSchema = z.object({
  nodes: z.record(z.string(), nodeSchema),
  rootId: z.string(),
  currentNodeId: z.string(),
  maxIterations: z.number(),
  currentIteration: z.number(),
  explorationConstant: z.number(),
  maxDepth: z.number()
});
export type SelectNodeInput = z.infer<typeof selectNodeInputSchema>;

export const config: EventConfig = {
  type: 'event',
  name: 'SelectNode',
  description: 'Selects a node in the MCTS tree using UCB1 formula',
  subscribes: ['mcts.iteration.started'],
  emits: ['mcts.node.selected'],
  flows: ['code-review-flow'],
  input: selectNodeInputSchema
};

export const handler: StepHandler<typeof config> = async (input: SelectNodeInput, { emit, logger, state, traceId }) => {
  const { nodes, rootId, currentNodeId, maxIterations, currentIteration, explorationConstant, maxDepth } = input;

  // Select the node with the highest UCB1 value
  const selectedNode = await selectNode(nodes, rootId, currentNodeId, maxIterations, currentIteration, explorationConstant, maxDepth);

  await emit({
    topic: 'mcts.node.selected',
    data: { 
      nodes,
      rootId,
      selectedNodeId: selectedNode.id,
      maxIterations,
      currentIteration,
      explorationConstant,
      maxDepth
    }
  });
};