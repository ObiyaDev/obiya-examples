import { EventConfig, StepHandler } from 'motia';
import { z } from 'zod';
import { PlanPart } from '../shared/types';

// Define input schema with simpler validation
const inputSchema = z.object({
  part: z.string(),
  priority: z.union([z.number(), z.string()]).optional(),
  suggestionId: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.string()
});

export const config: EventConfig = {
  type: 'event',
  name: 'Compose',
  description: 'Composes plan parts into a complete plan',
  subscribes: ['review.planPart'],
  emits: ['review.planComposed'],
  flows: ['code-review-flow'],
  input: inputSchema
};

export const handler: StepHandler<typeof config> = async (input, { emit, logger, state, traceId }) => {
  logger.info('Received plan part', { part: input.part });

  try {
    // Get existing plan parts from state
    const existingParts: PlanPart[] = await state.get(traceId, 'planParts') || [];
    
    // Add new part to the collection
    const updatedParts = [...existingParts, input];
    
    // Store updated plan parts
    await state.set(traceId, 'planParts', updatedParts);
    
    // Get count of unique timestamps to track unique events
    const uniqueEvents = new Set(updatedParts.map(p => p.timestamp)).size;
    
    // Check if we've collected enough parts to compose a plan
    // In a real implementation, this logic would be more sophisticated
    if (updatedParts.length >= 3 || uniqueEvents >= 3) {
      logger.info('Composing plan from collected parts', { partCount: updatedParts.length });
      
      // Sort plan parts by priority if available
      const sortedParts = sortPlanParts(updatedParts);
      
      // Create the composed plan
      const composedPlan = {
        title: 'Code Review Plan',
        sections: [
          {
            heading: 'Introduction',
            content: 'This plan outlines the recommended actions based on the code review.'
          },
          {
            heading: 'Identified Issues',
            content: createIssuesSection(sortedParts)
          },
          {
            heading: 'Recommendations',
            content: createRecommendationsSection(sortedParts)
          }
        ],
        timestamp: new Date().toISOString()
      };
      
      // Emit the composed plan
      await emit({
        topic: 'review.planComposed',
        data: composedPlan
      });
      
      logger.info('Plan composition complete');
    } else {
      logger.info('Waiting for more plan parts before composing', { 
        currentCount: updatedParts.length,
        uniqueEvents
      });
    }
  } catch (error) {
    logger.error('Error composing plan', { error: error instanceof Error ? error.message : String(error) });
  }
};

// Helper function to sort plan parts by priority
function sortPlanParts(parts: PlanPart[]): PlanPart[] {
  return [...parts].sort((a, b) => {
    // If priorities are numbers, sort numerically
    if (typeof a.priority === 'number' && typeof b.priority === 'number') {
      return a.priority - b.priority;
    }
    
    // If priorities are strings like 'high', 'medium', 'low'
    if (typeof a.priority === 'string' && typeof b.priority === 'string') {
      const priorityValues: Record<string, number> = {
        high: 1,
        medium: 2,
        low: 3
      };
      
      return (priorityValues[a.priority] || 999) - (priorityValues[b.priority] || 999);
    }
    
    // If one has priority and the other doesn't, prioritize the one with priority
    if (a.priority && !b.priority) return -1;
    if (!a.priority && b.priority) return 1;
    
    // Default: sort by timestamp
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
}

// Helper function to create issues section from plan parts
function createIssuesSection(parts: PlanPart[]): string {
  // Filter parts that look like issues (contain 'problem', 'error', etc.)
  const issuesParts = parts.filter(part => {
    return (part as any).problem || part.error || 
           (part.part && (
             part.part.toLowerCase().includes('issue') || 
             part.part.toLowerCase().includes('problem') ||
             part.part.toLowerCase().includes('error')
           ));
  });
  
  if (issuesParts.length === 0) {
    return 'No significant issues identified.';
  }
  
  // Format the issues as a list
  return issuesParts.map(part => {
    if ((part as any).problem) return `- ${(part as any).problem}`;
    if (part.error) return `- Error: ${part.error}`;
    return `- ${part.part}`;
  }).join('\n');
}

// Helper function to create recommendations section from plan parts
function createRecommendationsSection(parts: PlanPart[]): string {
  // Filter parts that look like recommendations or suggestions
  const recommendationParts = parts.filter(part => {
    return (part as any).suggestion || part.suggestionId ||
           (part.part && (
             part.part.toLowerCase().includes('suggestion') ||
             part.part.toLowerCase().includes('recommend') ||
             part.part.toLowerCase().includes('implement') ||
             part.part.toLowerCase().includes('improve')
           ));
  });
  
  if (recommendationParts.length === 0) {
    return 'No specific recommendations at this time.';
  }
  
  // Format the recommendations as a list
  return recommendationParts.map(part => {
    if ((part as any).suggestion) return `- ${(part as any).suggestion}`;
    return `- ${part.part}`;
  }).join('\n');
} 