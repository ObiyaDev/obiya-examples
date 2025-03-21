import { z } from 'zod';
import { Commits } from "../utils/repository";
import { execSync } from 'child_process';

export const nodeSchema = z.object({
  id: z.string(),
  parent: z.string().nullable(),
  children: z.array(z.string()),
  visits: z.number(),
  value: z.number(),
  state: z.string().optional(),
  isTerminal: z.boolean().optional()
});
export type Node = z.infer<typeof nodeSchema>;

export async function selectNode(nodes: Record<string, Node>, rootId: string, currentNodeId: string, maxIterations: number, currentIteration: number, explorationConstant: number, maxDepth: number) {
  const prompt = 'TODO: select the nodeId (string) with the highest UCB1 value';
  const nodeId = await coerce(prompt, z.string());
  return nodes[nodeId];
}

export const nodeExpansionSchema = z.object({
  reasoning: z.string().describe('the reasoning for the expansion'),
  steps: z.array(z.string()).describe('the steps of the expansion'),
})
export type NodeExpansion = z.infer<typeof nodeExpansionSchema>;

/* TODO use claude instead of openai
await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "system", content: "You are a helpful assistant that generates possible reasoning steps." },
    { role: "user", content: `Expand the following reasoning step: ${currentNode.state}` }
  ]
});
*/
export async function expandNode(currentNode: string) {
  const prompt = 'TODO';
  return await coerce(prompt, nodeExpansionSchema);
}

const issueSchema = z.object({
  claim: z.string().describe('the claim that is being made'),
  grounds: z.string().describe('the grounds that are being used to support the claim'),
  warrant: z.string().describe('the warrant that is being used to support the claim'),
  backing: z.string().describe('the backing that is being used to support the claim'),
  qualifier: z.string().describe('the qualifier that is being used to support the claim'),
})
export type Issue = z.infer<typeof issueSchema>;

const evaluationSchema = z.object({
  score: z.number().describe('the score of the evaluation'),
  issues: z.array(issueSchema),
  summary: z.string().describe('a human readable evaluation of the commits'),
  issueSummary: z.string().describe('a summary of the issues found in the commits'),
})
export type Evaluation = z.infer<typeof evaluationSchema>;

export async function evaluateCommits(commits: Commits, requirements: string) {
  const determineSystemBoundariesPrompt = `
    You are an expert professor of software development that can help determine the system boundaries
    of a proposed change to a codebase.
    You are given a set of commits, including code changes and commit messages, and the requirements
    that the code changes are attempting to meet.
    Your job is to describe the strategy employed by the developer through the commit history

    # Files Changed
    ${commits.files}

    # Commit Messages
    ${commits.messages}

    # Diff
    ${commits.diff}
  `;
  const strategy = await coerce(determineSystemBoundariesPrompt, z.string());
  const evaluationPrompt = `
    You are an expert professor of software development and the Toulmin Model of Argumentation.
    You are given a set of commits, including code changes and commit messages, and the requirements
    that the code changes are attempting to meet.
    You are also given the strategy employed by the developer through the commit history.
    Your job is to evaluate the commits and the strategy employed by the developer through the commit history
    using the Toulmin Model of Argumentation to break down any issues with the strategy.

    # Requirements
    ${requirements}

    # Strategy
    ${strategy} 
    
    # Files Changed
    ${commits.files}

    # Commit Messages
    ${commits.messages}

    # Diff
    ${commits.diff}
  `;
  return await coerce(evaluationPrompt, evaluationSchema);
}

const claudeCodeResponseSchema = z.object({
  cost_usd: z.number(),
  duration_ms: z.number(),
  duration_api_ms: z.number(),
  result: z.string(),
});


// Run Claude Code agent over CLI
export async function cli(prompt: string) {
  try {
    const response = execSync(`claude -p --json "${prompt.replace(/"/g, '\\"')}"`);
    return claudeCodeResponseSchema.parse(JSON.parse(response.toString()));
  } catch (error) {
    console.error('Error calling Claude CLI:', error instanceof Error ? error.message : String(error));
    // Check if the error is due to authentication issues
    if (error instanceof Error && 
        (error.message.includes('Invalid API key') || error.message.includes('not logged in'))) {
      console.warn('Claude CLI authentication failed. Using fallback response.');
      // Return a mock response for testing
      return {
        cost_usd: 0,
        duration_ms: 0,
        duration_api_ms: 0,
        result: JSON.stringify({
          note: "MOCK RESPONSE: Claude CLI authentication failed",
          fallback: true
        })
      };
    }
    // For other errors, rethrow
    throw error;
  }
}

// Force the response to be of a given type
export async function coerce<T extends z.ZodSchema>(prompt: string, schema: T): Promise<z.infer<T>> {
  try {
    const response = await cli(`
      ${prompt}

      # Output Format (IMPORTANT)
      Output JSON in the shape ${JSON.stringify(claudeCodeResponseSchema.shape)}
      Output only the JSON, do not include any other text.
    `);
    
    try {
      // Try to parse the result as the requested schema
      return schema.parse(JSON.parse(response.result));
    } catch (parseError) {
      console.warn('Failed to parse Claude response as the requested schema', parseError);
      
      // If the response indicates it's a fallback due to auth failure
      if (response.result.includes('MOCK RESPONSE')) {
        // Generate appropriate fallback based on the schema
        if (schema.constructor.name === evaluationSchema.constructor.name) {
          return {
            score: 0.5,
            issues: [{
              claim: "Mock claim due to Claude authentication failure",
              grounds: "Claude CLI authentication failed",
              warrant: "Fallback response generated",
              backing: "No actual Claude evaluation performed",
              qualifier: "This is not a real evaluation"
            }],
            summary: "MOCK RESPONSE: Could not authenticate with Claude. This is a fallback response.",
            issueSummary: "Claude authentication failed - using mock data."
          } as any as z.infer<T>;
        } else if (schema.constructor.name === simulationResultSchema.constructor.name) {
          return {
            nodeId: "mock-node",
            value: 0.5,
            explanation: "MOCK RESPONSE: Could not authenticate with Claude. This is a fallback score."
          } as any as z.infer<T>;
        } else if (schema.constructor.name === nodeExpansionSchema.constructor.name) {
          return {
            reasoning: "MOCK RESPONSE: Could not authenticate with Claude.",
            steps: ["Mock step 1", "Mock step 2"]
          } as any as z.infer<T>;
        } else if (schema.constructor.name === z.string().constructor.name) {
          return "MOCK RESPONSE: Could not authenticate with Claude. This is fallback text." as any as z.infer<T>;
        }
      }
      
      // For other parsing issues, rethrow
      throw parseError;
    }
  } catch (error) {
    console.error('Error in coerce function:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Add a new schema for simulation results
export const simulationResultSchema = z.object({
  nodeId: z.string().describe('the ID of the node being evaluated'),
  value: z.number().describe('the score of the evaluation, between 0 and 1'),
  explanation: z.string().describe('explanation of why this score was assigned')
});
export type SimulationResult = z.infer<typeof simulationResultSchema>;

/**
 * Evaluates the quality of reasoning paths from expanded nodes
 * Used in the simulation phase of MCTS to quickly assess the potential of different paths
 * @param parentState The state of the parent node from which expansion occurred
 * @param expandedStates Array of expanded reasoning states to evaluate
 * @param expandedNodeIds Array of node IDs corresponding to the expanded states
 * @returns A simulation result with value score
 */
export async function evaluateReasoning(
  parentState: string, 
  expandedStates: string[], 
  expandedNodeIds?: string[]
): Promise<SimulationResult> {
  if (expandedStates.length === 0) {
    throw new Error('No expanded states to evaluate');
  }

  const bestStateIndex = Math.floor(Math.random() * expandedStates.length);
  const selectedState = expandedStates[bestStateIndex];
  
  const prompt = `
    You are an expert evaluator of software development reasoning.
    I'll show you a reasoning path consisting of an initial state and a possible next step.
    Rate how promising this reasoning path is for solving a software development problem.
    
    Initial reasoning state:
    ${parentState}
    
    Possible next step in reasoning:
    ${selectedState}
    
    Evaluate the quality of this reasoning path on a scale from 0.0 to 1.0, where:
    - 0.0 means the reasoning is completely flawed or irrelevant
    - 0.5 means the reasoning is somewhat reasonable but has issues
    - 1.0 means the reasoning is excellent and very promising
    
    Provide:
    1. A numerical score between 0.0 and 1.0
    2. A brief explanation of why you assigned this score
  `;

  // Get result from Claude
  const result = await coerce(prompt, simulationResultSchema);
  
  // Use the expanded node ID if provided, otherwise use the state itself
  const nodeId = expandedNodeIds && expandedNodeIds.length > bestStateIndex 
    ? expandedNodeIds[bestStateIndex] 
    : expandedStates[bestStateIndex];
  
  return {
    nodeId,
    value: result.value,
    explanation: result.explanation
  };
}
