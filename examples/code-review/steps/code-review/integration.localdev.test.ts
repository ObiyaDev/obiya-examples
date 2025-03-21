import { handler as apiHandler } from './reviewRequest.api.step';
import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import { config as apiConfig } from './reviewRequest.api.step';

// Mock the event emitting system to track events
const events: Record<string, any[]> = {};

// Create a promise map for waiting on events
const eventPromises: Record<string, { resolve: Function, promise: Promise<any> }> = {};

// Function to wait for a specific event to be emitted
function waitForEvent(topic: string, timeout = 20000): Promise<any> {
  // If the event already happened, resolve immediately
  if (events[topic] && events[topic].length > 0) {
    return Promise.resolve(events[topic][events[topic].length - 1]);
  }
  
  // If we already have a promise for this event, return it
  if (eventPromises[topic]) {
    return eventPromises[topic].promise;
  }
  
  // Create a new promise for this event
  let resolvePromise: Function;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    
    // Add timeout
    setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${topic}`));
    }, timeout);
  });
  
  eventPromises[topic] = { 
    resolve: resolvePromise!, 
    promise 
  };
  
  return promise;
}

// Create mock context for tracking flow through the steps
const createTestContext = () => ({
  emit: jest.fn().mockImplementation((event: any) => {
    console.log(`Emitting event: ${event.topic}`);
    console.log('Event data:', JSON.stringify(event.data).substring(0, 200) + '...');
    if (!events[event.topic]) {
      events[event.topic] = [];
    }
    events[event.topic].push(event.data);
    
    // Resolve any promises waiting for this event
    if (eventPromises[event.topic]) {
      eventPromises[event.topic].resolve(event.data);
    }
    
    // Dispatch the event to the appropriate handler
    processEvent(event.topic, event.data);
    return Promise.resolve();
  }),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  state: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn()
  },
  traceId: 'integration-test-trace-id'
});

// Import all the handler functions
import { handler as controllerHandler } from './controller.step';
import { handler as selectNodeHandler } from './selectNode.step';
import { handler as expandNodeHandler } from './expandNode.step';
import { handler as simulateHandler } from './simulate.step';
import { handler as backPropagateHandler } from './backPropogate.step';
import { handler as selectBestMoveHandler } from './selectBestMove.step';
import { handler as markdownReportHandler } from './markdownReport.step';

// Mock Claude calls to prevent actual API calls during testing
jest.mock('../shared/agents/claude', () => {
  const originalModule = jest.requireActual('../shared/agents/claude');
  
  return {
    ...originalModule,
    // Mock the evaluateCommits function
    evaluateCommits: jest.fn().mockImplementation(async () => ({
      score: 0.75,
      issues: [
        {
          claim: "Implementation follows MCTS algorithm structure",
          grounds: "Code shows selection, expansion, simulation, and backpropagation phases",
          warrant: "MCTS requires these specific phases to function correctly",
          backing: "Research papers on MCTS describe this specific structure",
          qualifier: "The implementation might need optimization for specific use cases"
        }
      ],
      summary: "The code implements a Monte Carlo Tree Search algorithm for code review. It includes all required phases and applies them to reasoning about code quality.",
      issueSummary: "The implementation follows the MCTS structure but might benefit from optimization."
    })),
    
    // Mock expandNode function
    expandNode: jest.fn().mockImplementation(async (state) => ({
      reasoning: "Expanding node with state: " + state,
      steps: [
        "Consider code structure improvements",
        "Analyze algorithm efficiency",
        "Evaluate error handling approach"
      ]
    })),
    
    // Mock evaluateReasoning function
    evaluateReasoning: jest.fn().mockImplementation(async (parentState, expandedStates, expandedNodeIds) => ({
      nodeId: expandedNodeIds ? expandedNodeIds[0] : "b498fee8-5eec-47b7-b15b-9470241089be",
      value: 0.8,
      explanation: "This path shows promise for improving code review outcomes"
    }))
  };
});

// Mock the repository module to avoid actual git operations
jest.mock('../shared/utils/repository', () => {
  const fs = require('fs');
  const path = require('path');
  
  // Create mock data with limited size
  const MAX_DIFF_SIZE = 50 * 1024; // 50KB max diff size
  const createMockDiff = (size = 10 * 1024) => {
    const chunk = '+function example() {\n-  console.log("old");\n+  console.log("new");\n}\n';
    const repeats = Math.min(Math.floor(size / chunk.length), Math.floor(MAX_DIFF_SIZE / chunk.length));
    return chunk.repeat(repeats);
  };
  
  return {
    GitInterface: {
      parseRepoUrl: jest.fn().mockImplementation((repoUrl) => {
        return new URL(`file://${repoUrl}`);
      }),
      create: jest.fn().mockResolvedValue({
        getDiff: jest.fn().mockReturnValue(createMockDiff()),
        getMessages: jest.fn().mockReturnValue("abc123 Implement MCTS selection\ndef456 Add expansion phase\nghi789 Implement simulation"),
        getFiles: jest.fn().mockReturnValue("steps/code-review/selectNode.step.ts\nsteps/code-review/expandNode.step.ts\nsteps/code-review/simulate.step.ts"),
        resolveCommit: jest.fn().mockImplementation((commit) => commit || "abc123")
      })
    },
    Commits: {
      create: jest.fn().mockImplementation((traceId, state, input) => {
        return {
          repoUrl: input.repoUrl,
          branch: input.branch,
          reviewStartCommit: "abc123",
          reviewEndCommit: "def456",
          diff: createMockDiff(),
          messages: "abc123 Implement MCTS selection\ndef456 Add expansion phase\nghi789 Implement simulation",
          files: "steps/code-review/selectNode.step.ts\nsteps/code-review/expandNode.step.ts\nsteps/code-review/simulate.step.ts",
          history: {
            diff: createMockDiff(),
            messages: "abc123 Implement MCTS selection\ndef456 Add expansion phase\nghi789 Implement simulation",
            files: "steps/code-review/selectNode.step.ts\nsteps/code-review/expandNode.step.ts\nsteps/code-review/simulate.step.ts"
          },
          git: {
            getDiff: jest.fn().mockReturnValue(createMockDiff()),
            getMessages: jest.fn().mockReturnValue("abc123 Implement MCTS selection\ndef456 Add expansion phase\nghi789 Implement simulation"),
            getFiles: jest.fn().mockReturnValue("steps/code-review/selectNode.step.ts\nsteps/code-review/expandNode.step.ts\nsteps/code-review/simulate.step.ts")
          }
        };
      })
    }
  };
});

// Map of topic handlers for event routing
const topicHandlers: Record<string, Function> = {
  'review.requested': controllerHandler,
  'mcts.iteration.started': selectNodeHandler,
  'mcts.node.selected': expandNodeHandler,
  'mcts.node.expanded': simulateHandler,
  'mcts.simulation.completed': backPropagateHandler,
  'mcts.backpropagation.completed': controllerHandler,
  'mcts.iterations.completed': selectBestMoveHandler,
  'code-review.reasoning.completed': markdownReportHandler
};

// Process events by routing them to the appropriate handler
async function processEvent(topic: string, data: any) {
  console.log(`Processing event: ${topic}`);
  const handler = topicHandlers[topic];
  if (handler) {
    await handler(data, createTestContext());
  } else {
    console.log(`No handler found for topic: ${topic}`);
  }
}

describe('Integration Tests', () => {
  beforeEach(() => {
    // Clear stored events between tests
    Object.keys(events).forEach(key => delete events[key]);
    // Clear event promises
    Object.keys(eventPromises).forEach(key => delete eventPromises[key]);
  });
  
  // We use a longer timeout as this test covers the entire workflow
  jest.setTimeout(30000);
  
  it('should analyze commits and generate markdown report', async () => {
    // Create API request
    const req = {
      body: {
        repository: process.cwd(), // Use current directory
        branch: 'main',
        requirements: 'Create an MCTS based reasoning loop for reviewing code commits',
        depth: 2,
        reviewStartCommit: '', // Start from the beginning
        reviewEndCommit: 'HEAD~14', // Last 14 commits
        reviewMaxCommits: 14,
        maxIterations: 3 // Limit to just 3 iterations for faster testing
      },
      pathParams: {},
      queryParams: {},
      headers: {}
    };
    
    // Create test context for API call
    const context = createTestContext();
    
    // Call API handler
    const result = await apiHandler(req as any, context as any);
    
    // Verify API response
    expect(result.status).toBe(200);
    // Type assertion for the body
    const responseBody = result.body as { message: string };
    expect(responseBody.message).toBe('Code review process initiated');
    
    // Verify events were emitted and processed
    expect(events['review.requested']).toBeDefined();
    
    // Wait for the final event which indicates workflow completion
    await waitForEvent('code-review.report.generated');
    
    // Log all received events for debugging
    console.log('All events:', Object.keys(events));
    // Check each step of the chain
    console.log('Review requested:', events['review.requested'] ? 'Yes' : 'No');
    console.log('MCTS iteration started:', events['mcts.iteration.started'] ? 'Yes' : 'No');
    console.log('MCTS node selected:', events['mcts.node.selected'] ? 'Yes' : 'No');
    console.log('MCTS node expanded:', events['mcts.node.expanded'] ? 'Yes' : 'No');
    console.log('MCTS simulation completed:', events['mcts.simulation.completed'] ? 'Yes' : 'No');
    console.log('MCTS iterations completed:', events['mcts.iterations.completed'] ? 'Yes' : 'No');
    console.log('Code review reasoning completed:', events['code-review.reasoning.completed'] ? 'Yes' : 'No');
    console.log('Code review report generated:', events['code-review.report.generated'] ? 'Yes' : 'No');
    
    // Verify final event for markdown report generation
    expect(events['code-review.report.generated']).toBeDefined();
    
    if (events['code-review.report.generated']) {
      const reportResult = events['code-review.report.generated'][0];
      
      // Check report properties
      expect(reportResult.filepath).toBeDefined();
      expect(reportResult.content).toBeDefined();
      
      // Verify file exists
      expect(fs.existsSync(reportResult.filepath)).toBe(true);
      
      // Verify content has expected sections
      const content = fs.readFileSync(reportResult.filepath, 'utf8');
      expect(content).toContain('# Code Review Analysis');
      expect(content).toContain('## Selected Reasoning Path');
      expect(content).toContain('## MCTS Tree Visualization');
      expect(content).toContain('```mermaid');
      
      // Clean up
      fs.unlinkSync(reportResult.filepath);
    }
  });
}); 