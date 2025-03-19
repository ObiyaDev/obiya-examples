import { EventConfig, StepHandler } from 'motia';
import { z } from 'zod';

// Define input schema
const inputSchema = z.object({
  repository: z.string(),
  branch: z.string(),
  requirements: z.string(),
  timestamp: z.string()
});

export const config: EventConfig = {
  type: 'event',
  name: 'AnalyzeContext',
  description: 'Analyzes the context for code review',
  subscribes: ['review.requested'],
  emits: ['review.problemFound', 'review.planPart'],
  flows: ['code-review-flow'],
  input: inputSchema
};

export const handler: StepHandler<typeof config> = async (input, { emit, logger, state, traceId }) => {
  logger.info('Analyzing review context', { input });

  try {
    // TODO: Implement actual repository analysis
    // For now, using placeholder implementation

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