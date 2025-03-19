import { EventConfig, StepHandler } from 'motia';
import { z } from 'zod';

// Define a single simple input schema
const inputSchema = z.object({
  suggestionId: z.string(),
  timestamp: z.string()
  // All other fields are optional or could be different types
}).passthrough(); // Allow additional properties dynamically

export const config: EventConfig = {
  type: 'event',
  name: 'Consider',
  description: 'Considers arguments and suggestions to generate counter arguments',
  subscribes: ['review.argument'],
  emits: ['review.counterArgument', 'review.suggestion'],
  flows: ['code-review-flow'],
  input: inputSchema
};

export const handler: StepHandler<typeof config> = async (input, { emit, logger, state, traceId }) => {
  logger.info('Considering input', {
    type: 'suggestion' in input ? 'suggestion' : 'argument',
    id: input.suggestionId
  });

  try {
    // Determine if this is a suggestion or an argument
    if ('suggestion' in input) {
      // This is a suggestion event
      await considerSuggestion(input, { emit, logger, state, traceId });
    } else if ('argument' in input) {
      // This is an argument event
      await considerArgument(input, { emit, logger, state, traceId });
    } else {
      logger.warn('Unknown input type received');
    }
  } catch (error) {
    logger.error('Error in consideration', { error: error instanceof Error ? error.message : String(error) });
  }
};

// Helper function to consider suggestions
async function considerSuggestion(suggestion: any, { emit, logger, state, traceId }: any) {
  // Store the suggestion in state if not already stored
  await state.set(traceId, `considered.suggestion.${suggestion.suggestionId}`, suggestion);
  
  // Generate a counter argument based on the suggestion
  // TODO: Implement actual counter argument generation logic
  const counterArgument = {
    suggestionId: suggestion.suggestionId,
    counterArgument: `The suggestion might introduce complexity without sufficient benefit.`,
    evidence: 'Need to consider maintenance overhead',
    timestamp: new Date().toISOString()
  };
  
  // Only emit counter arguments occasionally to avoid infinite loops
  if (shouldEmitCounterArgument(suggestion)) {
    // Emit the counter argument
    await emit({
      topic: 'review.counterArgument',
      data: counterArgument
    });
    
    logger.info('Counter argument emitted for suggestion', { 
      suggestionId: suggestion.suggestionId,
      counterArgument: counterArgument.counterArgument
    });
  } else {
    logger.info('Decided not to emit counter argument for this suggestion', { 
      suggestionId: suggestion.suggestionId 
    });
  }
}

// Helper function to consider arguments
async function considerArgument(argument: any, { emit, logger, state, traceId }: any) {
  // Retrieve the original suggestion from state
  const suggestion = await state.get(traceId, `considered.suggestion.${argument.suggestionId}`);
  
  if (!suggestion) {
    logger.warn('Could not find original suggestion for argument', { 
      suggestionId: argument.suggestionId 
    });
    return;
  }
  
  // Generate a counter argument based on the argument
  // TODO: Implement actual counter argument generation logic
  const counterArgument = {
    suggestionId: argument.suggestionId,
    counterArgument: `While the argument is sound, we should consider alternative approaches that might be simpler.`,
    evidence: 'Simplicity principle in software design',
    timestamp: new Date().toISOString()
  };
  
  // Only emit counter arguments occasionally to avoid infinite loops
  if (shouldEmitCounterArgument(argument)) {
    // Emit the counter argument
    await emit({
      topic: 'review.counterArgument',
      data: counterArgument
    });
    
    logger.info('Counter argument emitted for argument', { 
      suggestionId: argument.suggestionId,
      counterArgument: counterArgument.counterArgument
    });
  } else {
    logger.info('Decided not to emit counter argument for this argument', { 
      suggestionId: argument.suggestionId 
    });
  }
}

// Helper function to decide whether to emit a counter argument
// This prevents infinite loops of arguments and counter arguments
function shouldEmitCounterArgument(input: any): boolean {
  // Simple implementation: emit counter arguments with 50% probability
  // In a real implementation, this would use more sophisticated logic
  return Math.random() > 0.5;
} 