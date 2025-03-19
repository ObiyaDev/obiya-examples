/**
 * Repository request input
 */
export interface RepositoryRequest {
  repository: string;
  branch: string;
  requirements: string;
  timestamp: string;
}

/**
 * Problem identified in code review
 */
export interface Problem {
  problem: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  area: string;
  timestamp: string;
}

/**
 * Suggestion to address a problem
 */
export interface Suggestion {
  suggestionId: string;
  problem: string;
  suggestion: string;
  rationale: string;
  code?: string;
  confidence: number;
  timestamp: string;
}

/**
 * Argument for or against a suggestion
 */
export interface Argument {
  suggestionId: string;
  argument: string;
  strength: 'strong' | 'moderate' | 'weak';
  evidence: string;
  timestamp: string;
}

/**
 * Counter argument to an argument
 */
export interface CounterArgument {
  suggestionId: string;
  counterArgument: string;
  evidence?: string;
  timestamp: string;
}

/**
 * Plan part to be composed into a complete plan
 */
export interface PlanPart {
  part: string;
  priority?: number | 'high' | 'medium' | 'low';
  suggestionId?: string;
  error?: string;
  timestamp: string;
}

/**
 * Section of a plan document
 */
export interface PlanSection {
  heading: string;
  content: string;
}

/**
 * Complete plan document
 */
export interface Plan {
  title: string;
  sections: PlanSection[];
  timestamp: string;
}

/**
 * Completion event data
 */
export interface ReviewComplete {
  planTitle: string;
  sectionCount: number;
  timestamp: string;
} 