import { InternalStateManager } from "node_modules/motia/dist/types";
import { z } from "zod";

const reflectionStateSchema = z.object({
  type: z.string().describe('Type of reflection state (e.g. analyze, suggest, consider)'),
  timestamp: z.string().datetime().describe('ISO timestamp of when this state was created'),
});
export type ReflectionState = z.infer<typeof reflectionStateSchema>;

const reflectionBranchSchema = z.object({
  stack: z.array(reflectionStateSchema).describe('Stack of reflection states in this branch'),
  problem: z.string().describe('The problem being analyzed in this branch'),
  depth: z.number().int().min(0).describe('Current depth of analysis'), 
});
export type ReflectionBranch = z.infer<typeof reflectionBranchSchema>; 

const reflectionProblemSchema = z.object({
  problem: z.string().describe('Description of the problem being reflected on'),
  traceId: z.string().uuid().describe('Trace ID for correlating reflection states'),
});
export type ReflectionProblem = z.infer<typeof reflectionProblemSchema>;

export class AnalysisContext {
  constructor(traceId: string, reflectionId: string, public state: InternalStateManager) {
    const branches = await state.get<ReflectionBranch[]>(traceId, 'analysis') || [] as ReflectionBranch[];
    
  }
  
  
  
export type ReflectionStatePushInput = {
    type: string;
    timestamp: string;
    input: z.infer<typeof inputSchema>;
  };

export const reflectionStatePush = async (traceId: string, state: InternalStateManager, reflection: ReflectionState) => {
    let reflectionBranches = await state.get<ReflectionBranches>(traceId, 'reflectionBranches');
    if (!reflectionBranches) reflectionBranches = [] as ReflectionBranches;
  
    reflectionStack = [...reflectionStack, {
      type: 'analyze',
      timestamp: new Date().toISOString(),
      input
    }]
    await state.set(traceId, 'reflectionStack', reflectionStack);
  }
