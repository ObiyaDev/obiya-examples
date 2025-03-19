import { EventConfig, StepHandler } from 'motia';
import { z } from 'zod';

// Define input schema
const inputSchema = z.object({
  problem: z.string(),
  severity: z.string(),
  area: z.string(),
  timestamp: z.string()
});

export const config: EventConfig = {
  type: 'event',
  name: 'Suggest',
  description: 'Suggests solutions for identified problems',
  subscribes: ['review.problemFound'],
  emits: ['review.suggestion'],
  flows: ['code-review-flow'],
  input: inputSchema
};

export const handler: StepHandler<typeof config> = async (input, { emit, logger, state, traceId }) => {
  logger.info('Suggesting solutions for problem', { problem: input.problem });

  try {
    // Retrieve original review request from state
    const reviewRequest = await state.get(traceId, 'reviewRequest');
    
    // Generate suggestion based on problem and context
    // TODO: Implement actual suggestion generation logic
    const suggestion = generateSuggestion(input, reviewRequest);
    
    // Emit the suggestion event
    await emit({
      topic: 'review.suggestion',
      data: {
        suggestionId: `sugg-${Date.now()}`,
        problem: input.problem,
        suggestion: suggestion.text,
        rationale: suggestion.rationale,
        code: suggestion.code,
        confidence: suggestion.confidence,
        timestamp: new Date().toISOString()
      }
    });
    
    logger.info('Suggestion emitted', { suggestion: suggestion.text });
  } catch (error) {
    logger.error('Error generating suggestion', { error: error instanceof Error ? error.message : String(error) });
  }
};

// Helper function to generate suggestions
// This would be replaced with actual AI-powered suggestion generation
function generateSuggestion(problem: any, context: any) {
  // Mock implementation
  return {
    text: `Consider optimizing the code in the ${problem.area} area`,
    rationale: 'Optimization could improve performance and resource usage',
    code: 'Example code would go here',
    confidence: 0.8
  };
} 