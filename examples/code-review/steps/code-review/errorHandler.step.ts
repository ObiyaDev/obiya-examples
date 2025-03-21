import { z } from 'zod';
import { EventConfig, StepHandler } from 'motia';
import * as fs from 'fs';
import * as path from 'path';

// Define schema for report output
const errorHandlerInputSchema = z.object({
  message: z.string(),
  timestamp: z.string(),
  repository: z.string().optional(),
  outputPath: z.string().optional()
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

    // Get the requirements from state or use a fallback
    let requirements: string = 'Unknown requirements';
    try {
      const stateRequirements = await state.get<string>(traceId, 'requirements');
      if (stateRequirements) {
        requirements = stateRequirements;
      }
    } catch (stateError) {
      logger.warn('Failed to get requirements from state', { error: stateError });
    }
    
    // Generate fallback review report
    const timestamp = input.timestamp || new Date().toISOString();
    const filePath = input.outputPath || path.join(process.cwd(), 'Review.md');
    
    const fallbackMarkdown = `# Code Review Analysis - ${timestamp}

## ⚠️ Error Report ⚠️

An error occurred during the code review process. This may be due to:
- Authentication issues with Claude API
- Problems accessing the repository
- Other system errors

### Error Details
${input.message}

### Requirements
${requirements}

## Repository Information
${input.repository ? `- Repository: ${input.repository}\n` : '- Repository: Unknown\n'}

## Fallback Evaluation

Since the automated code review process encountered an error, here's a fallback assessment:

The code was analyzed against the requirements: "${requirements}".

Due to technical limitations, we cannot provide a detailed analysis at this time.

## Recommended Next Steps

1. Check Claude CLI authentication
2. Verify repository access
3. Try running the review process again

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
    logger.error('Error in error handler step', error);
  }
}; 