// 4. Backpropagate activity
import { z } from 'zod';
import { EventConfig, StepHandler } from '@motiadev/core';

const backpropagateInputSchema = z.object({
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
  simulationResult: z.object({
    nodeId: z.string(),
    value: z.number()
  }),
  maxIterations: z.number(),
  currentIteration: z.number(),
  explorationConstant: z.number(),
  maxDepth: z.number()
});

export type BackpropagateInput = z.infer<typeof backpropagateInputSchema>;

export const backpropagateConfig: EventConfig = {
  type: 'event',
  name: 'Backpropagate',
  description: 'Updates node statistics based on simulation results',
  subscribes: ['mcts.simulation.completed'],
  emits: ['mcts.backpropagation.completed'],
  flows: ['code-review-flow'],
  input: backpropagateInputSchema
};

export const handler: StepHandler<typeof backpropagateConfig> = async (input: BackpropagateInput, { emit, logger, state, traceId }) => {
  const { nodes, rootId, simulationResult } = input;
  const { nodeId, value } = simulationResult;

  // Update node statistics
  let currentNode = nodes[nodeId];
  currentNode.visits += 1;
  currentNode.value += value;

  // Propagate updates to parent nodes
  let currentNodeId = nodeId;
  while (currentNode.parent) {
    currentNodeId = currentNode.parent;
    currentNode = nodes[currentNodeId];
    currentNode.visits += 1;
    currentNode.value += value;
  }

  await emit({
    topic: 'mcts.backpropagation.completed',
    data: { nodes }
  });
};  