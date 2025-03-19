import { EventConfig, StepHandler, Logger } from 'motia';
import { z } from 'zod';

// Define a single input schema with minimal required fields and passthrough for the rest
const inputSchema = z.object({
  suggestionId: z.string(),
  timestamp: z.string()
}).passthrough(); // Allow additional properties dynamically

export const config: EventConfig = {
  type: 'event',
  name: 'Reflect',
  description: 'Reflects on suggestions and arguments',
  subscribes: ['review.suggestion', 'review.counterArgument'],
  emits: ['review.argument', 'review.planPart', 'review.requested'],
  flows: ['code-review-flow'],
  input: inputSchema
};

export const handler: StepHandler<typeof config> = async (
  input: z.infer<typeof inputSchema>,
  { 
    emit,
    logger,
    state,
    traceId 
  }
) => {
  logger.info('Reflecting on input', { 
    type: 'suggestion' in input ? 'suggestion' : 'counterArgument',
    id: 'suggestionId' in input ? input.suggestionId : 'unknown'
  });

  try {
    // Determine if this is a suggestion or counter argument
    if ('suggestion' in input) {
      // This is a suggestion event
      await reflectOnSuggestion(input, { emit, logger, state, traceId });
    } else if ('counterArgument' in input) {
      // This is a counter argument event
      await reflectOnCounterArgument(input, { emit, logger, state, traceId });
    } else {
      logger.warn('Unknown input type received');
    }
  } catch (error) {
    logger.error('Error in reflection', { error: error instanceof Error ? error.message : String(error) });
  }
};

// Helper function to reflect on suggestions
async function reflectOnSuggestion(suggestion: any, { emit, logger, state, traceId }: any) {
  // Store the suggestion in state
  await state.set(traceId, `suggestion.${suggestion.suggestionId}`, suggestion);
  
  // Generate an argument based on the suggestion
  // TODO: Implement actual argument generation logic
  const argument = {
    suggestionId: suggestion.suggestionId,
    argument: `The suggestion to ${suggestion.suggestion} is valid because it addresses the core problem.`,
    strength: 'strong',
    evidence: 'Based on standard software engineering practices',
    timestamp: new Date().toISOString()
  };
  
  // Emit the argument
  await emit({
    topic: 'review.argument',
    data: argument
  });
  
  // Also emit a plan part
  await emit({
    topic: 'review.planPart',
    data: {
      part: `Implement suggestion: ${suggestion.suggestion}`,
      suggestionId: suggestion.suggestionId,
      priority: suggestion.confidence > 0.8 ? 'high' : 'medium',
      timestamp: new Date().toISOString()
    }
  });
  
  logger.info('Reflection on suggestion complete', { suggestionId: suggestion.suggestionId });
}

// Helper function to reflect on counter arguments
async function reflectOnCounterArgument(counterArg: any, { emit, logger, state, traceId }: any) {
  // Retrieve the original suggestion from state
  const suggestion = await state.get(traceId, `suggestion.${counterArg.suggestionId}`);
  
  if (!suggestion) {
    logger.warn('Could not find original suggestion for counter argument', { 
      suggestionId: counterArg.suggestionId 
    });
    return;
  }
  
  // Generate a more refined argument based on the counter argument
  // TODO: Implement actual refined argument generation logic
  const refinedArgument = {
    suggestionId: counterArg.suggestionId,
    argument: `While considering the counter point that ${counterArg.counterArgument}, the suggestion still has merit because ${suggestion.rationale}.`,
    strength: 'moderate',
    evidence: 'Balancing multiple considerations',
    timestamp: new Date().toISOString()
  };
  
  // Emit the refined argument
  await emit({
    topic: 'review.argument',
    data: refinedArgument
  });
  
  logger.info('Reflection on counter argument complete', { suggestionId: counterArg.suggestionId });
} 