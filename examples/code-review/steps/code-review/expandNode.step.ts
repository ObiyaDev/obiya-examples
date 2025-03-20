// 2. ExpandNode activity
import { z } from 'zod';
import { EventConfig, StepHandler } from 'motia';
import { expandNode } from '../shared/agents/claude';
import * as crypto from 'crypto';

const expandNodeInputSchema = z.object({
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
  selectedNodeId: z.string(),
  maxIterations: z.number(),
  currentIteration: z.number(),
  explorationConstant: z.number(),
  maxDepth: z.number()
});

export type ExpandNodeInput = z.infer<typeof expandNodeInputSchema>;

export const config: EventConfig = {
  type: 'event',
  name: 'ExpandNode',
  description: 'Expands a selected node by generating possible reasoning steps',
  subscribes: ['mcts.node.selected'],
  emits: ['mcts.node.expanded'],
  flows: ['code-review-flow'],
  input: expandNodeInputSchema
};

export const handler: StepHandler<typeof config> = async (input: ExpandNodeInput, { emit, logger, state, traceId }) => {
  const { nodes, rootId, selectedNodeId } = input;
  const currentNode = nodes[selectedNodeId];

  // Generate possible next reasoning steps with LLM
  const response = await expandNode(currentNode.state);

  // Create new nodes for each expanded step
  const expandedNodeIds = [];
  for (const step of response.steps) {
    const newNodeId = crypto.randomUUID();
    nodes[newNodeId] = {
      id: newNodeId,
      parent: currentNode.id,
      children: [],
      visits: 0,
      value: 0,
      state: step,
      isTerminal: false
    };
    expandedNodeIds.push(newNodeId);
  }

  await emit({
    topic: 'mcts.node.expanded',
    data: { nodes, expandedNodeIds }
  });
};
