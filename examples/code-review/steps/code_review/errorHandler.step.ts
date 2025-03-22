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
  logger.info('Handling review error', { error: input.message });

  // Generate fallback review report
  const timestamp = input.timestamp || new Date().toISOString();
  const filePath = input.outputPath || path.join(process.cwd(), 'Review.md');

  const fallbackMarkdown = `# Review Error Report - ${timestamp}\n\nThe review system failed completely with error: ${input.message}`;

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
}
