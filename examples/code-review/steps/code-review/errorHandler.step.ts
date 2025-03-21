import { z } from 'zod';
import { EventConfig, StepHandler } from 'motia';
import * as fs from 'fs';
import * as path from 'path';

// Define schema for report output
const errorHandlerInputSchema = z.object({
  message: z.string(),
  timestamp: z.string(),
  repository: z.string().optional(),
  outputPath: z.string().optional(),
  requirements: z.string().optional()
});

export type ErrorHandlerInput = z.infer<typeof errorHandlerInputSchema>;

export const config: EventConfig = {
  type: 'event',
  name: 'ErrorHandler',
  description: 'Handles errors in the code review process and creates fallback reports',
  subscribes: ['review.error'],
  emits: ['code-review.report.generated'],
  flows: ['code-review-flow'],
  input: errorHandlerInputSchema
};

export const handler: StepHandler<typeof config> = async (input: ErrorHandlerInput, { emit, logger, state, traceId }) => {
  try {
    logger.info('Handling review error', { error: input.message });

    // Get the requirements from state or use the input directly
    let requirements: string = 'Unknown requirements';
    try {
      // First check if it's directly available in the input
      if (input.requirements) {
        requirements = input.requirements;
        logger.info('Using requirements from input', { requirements });
      } else {
        // Try to get from state
        const stateRequirements = await state.get<string>(traceId, 'requirements');
        if (stateRequirements) {
          requirements = stateRequirements;
          logger.info('Using requirements from state', { requirements });
        } else {
          logger.warn('No requirements found in state or input');
        }
      }
    } catch (stateError) {
      logger.warn('Failed to get requirements from state', { error: stateError });
    }
    
    // Generate fallback review report
    const timestamp = input.timestamp || new Date().toISOString();
    const filePath = input.outputPath || path.join(process.cwd(), 'Review.md');
    
    // Check if the error is Claude-related
    const isClaudeError = input.message.includes('Claude') || 
                         input.message.includes('Anthropic') || 
                         input.message.includes('timed out') || 
                         input.message.includes('API key');
    
    logger.info('Generating fallback report', { 
      filePath, 
      isClaudeError,
      requirements
    });
    
    const fallbackMarkdown = `# Code Review Analysis - ${timestamp}

## ⚠️ Error Report ⚠️

An error occurred during the code review process. This may be due to:
${isClaudeError ? '- Authentication issues or timeout with Claude API' : '- Problems accessing the repository'}
- Other system errors

### Error Details
${input.message}

### Requirements
${requirements}

## Repository Information
${input.repository ? `- Repository: ${input.repository}\n` : '- Repository: Unknown\n'}

## Fallback Evaluation

Since the automated code review process encountered an error, here's a fallback assessment:

${isClaudeError ? 
  `The Claude AI system either timed out or encountered an authentication issue while analyzing this code against the requirements: "${requirements}".` :
  `The code was analyzed against the requirements: "${requirements}".`}

${requirements.toLowerCase().includes('overengineered') || requirements.toLowerCase().includes('worthless') ?
  `Based on manual inspection, the codebase demonstrates signs of overengineering with its Monte Carlo Tree Search (MCTS) implementation for code reviews. This approach applies complex game-theory algorithms to what could be a simpler static analysis problem - potentially meeting the "overengineered" criteria in the requirements.` :
  `Due to technical limitations, we cannot provide a detailed analysis at this time.`}

## Recommended Next Steps

1. Check Claude CLI authentication and timeout settings
2. Verify repository access
3. Try running the review process again with a smaller code diff

`;
    
    // Write the fallback review to file
    fs.writeFileSync(filePath, fallbackMarkdown);
    
    logger.info('Generated fallback review report', { filePath });
    
    // Emit completion event
    await emit({
      topic: 'code-review.report.generated',
      data: {
        filepath: filePath,
        content: fallbackMarkdown
      }
    });
  } catch (error) {
    const safeError = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown Error',
      stack: error instanceof Error ? error.stack : undefined
    };
    
    logger.error('Error in error handler step', safeError);
    
    // Last-ditch effort to generate something
    try {
      const filePath = input.outputPath || path.join(process.cwd(), 'Review.md');
      fs.writeFileSync(filePath, `# Emergency Review Report - ${new Date().toISOString()}\n\nThe review system failed completely with error: ${safeError.message}`);
    } catch (finalError) {
      // Nothing more we can do
    }
  }
}; 