// 5. SelectBestMove activity
import { z } from 'zod';
import { EventConfig, StepHandler } from 'motia';
import { nodeSchema } from '../shared/agents/claude';

// Define the selection mode options
export type SelectionMode = 'visits' | 'value' | 'value-ratio';

const selectBestMoveInputSchema = z.object({
  nodes: z.record(z.string(), nodeSchema),
  rootId: z.string(),
  currentIteration: z.number(),
  maxIterations: z.number(),
  explorationConstant: z.number(),
  maxDepth: z.number(),
  isComplete: z.boolean().optional().default(false),
  selectionMode: z.enum(['visits', 'value', 'value-ratio']).optional().default('visits')
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
  try {
    const { nodes, rootId, selectionMode = 'visits' } = input;
    
    // Validate root node exists
    if (!nodes[rootId]) {
      logger.error('Root node not found in tree', { rootId });
      return;
    }
    
    const rootNode = nodes[rootId];
    const { children } = rootNode;
    
    // If root has no children, return the root node itself
    if (!children || children.length === 0) {
      logger.warn('Root node has no children to select from', { rootId });
      
      await emit({
        topic: 'code-review.reasoning.completed',
        data: {
          selectedNodeId: rootId,
          state: rootNode.state,
          reasoning: 'No child nodes were explored during the MCTS process.',
          stats: {
            visits: rootNode.visits,
            value: rootNode.value,
            totalVisits: rootNode.visits,
            childrenCount: 0
          },
          allNodes: nodes
        }
      });
      return;
    }
    
    // Find the best child based on the selection mode
    let bestChildId = children[0]; // Default to first child
    let bestScore = -Infinity;
    
    for (const childId of children) {
      const child = nodes[childId];
      if (!child) {
        logger.warn('Child node referenced but not found in tree', { childId });
        continue;
      }
      
      let score: number;
      switch (selectionMode) {
        case 'visits':
          score = child.visits;
          break;
        case 'value':
          score = child.value;
          break;
        case 'value-ratio':
          score = child.visits > 0 ? child.value / child.visits : 0;
          break;
        default:
          score = child.visits; // Default to visits
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestChildId = childId;
      }
    }
    
    const bestChild = nodes[bestChildId];
    
    // Generate reasoning about the selection
    const selectionCriteria = {
      'visits': 'number of visits',
      'value': 'total accumulated value',
      'value-ratio': 'value per visit ratio'
    };
    
    const reasoning = `Selected based on ${selectionCriteria[selectionMode]}: The node was visited ${bestChild.visits} times with a total value of ${bestChild.value}.`;
    
    logger.info('Best move selected', {
      nodeId: bestChildId,
      selectionMode,
      visits: bestChild.visits,
      value: bestChild.value,
      rootVisits: rootNode.visits,
      rootValue: rootNode.value
    });
    
    // Emit the selected best move
    await emit({
      topic: 'code-review.reasoning.completed',
      data: {
        selectedNodeId: bestChildId,
        state: bestChild.state,
        reasoning,
        stats: {
          visits: bestChild.visits,
          value: bestChild.value,
          totalVisits: rootNode.visits,
          childrenCount: children.length
        },
        allNodes: nodes
      }
    });
  } catch (error) {
    logger.error('Error selecting best move', error);
  }
};