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
  const response = execSync(`claude -p --json ${prompt}`);
  return claudeCodeResponseSchema.parse(JSON.parse(response.toString()));
}

// Force the response to be of a given type
export async function coerce<T extends z.ZodSchema>(prompt: string, schema: T): Promise<z.infer<T>> {
  const response = await cli(`
    ${prompt}

    # Output Format (IMPORTANT)
    Output JSON in the shape ${JSON.stringify(claudeCodeResponseSchema.shape)}
    Output only the JSON, do not include any other text.
  `);
  return schema.parse(response.result);
}
