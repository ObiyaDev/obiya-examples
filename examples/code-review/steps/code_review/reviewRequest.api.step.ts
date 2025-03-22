import { ApiRouteConfig, StepHandler } from 'motia';
import { z } from 'zod';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const bodySchema = z.object({
  repository: z.string().min(1).describe('The repository to review. Should be a valid git repository of format: [<protocol>://][<host>/][<owner>]/[<repo>], e.g. https://github.com/buger/probe.git'),
  branch: z.string().optional().default('main').describe('The branch to review. Defaults to main.'),
  depth: z.number().nonnegative().optional().default(2).describe('The depth of the review to perform, defaults to 2. Depth is the number of abstraction layers the AI will reason about during the review.'),
  reviewStartCommit: z.string().optional().default('').describe('The commit hash to start the review from. Defaults to the oldest commit. Defaults to the oldest commit of the branch if not provided.'),
  reviewMaxCommits: z.number().nonnegative().optional().default(100).describe('The maximum number of commits to review. Defaults to 100.'),
  reviewEndCommit: z.string().optional().default('HEAD').describe('The commit hash to end the review at. Defaults to the latest commit.'),
  requirements: z.string().min(1).optional().default('').describe('The requirements for the code review. Defaults to an empty string.'),
  outputUrl: z.string().optional().default('file://../..').describe('The URL to save the review file. Defaults to the current directory.'),
  maxIterations: z.number().nonnegative().optional().describe('The maximum number of iterations for the code review. This is deprecated and will be removed in future versions. Use max_iterations instead.')
});

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ReviewRequest',
  description: 'Initiate a code review process',
  path: '/api/review',
  method: 'POST',
  emits: ['review.requested'],
  flows: ['code-review-flow'],
  bodySchema
};

export const handler: StepHandler<typeof config> = async (req, { emit, logger }) => {
  logger.info('Review requested via API', { body: req.body });

  let output_url = req.body.outputUrl || 'file://Review.md';
  if (!output_url.startsWith('file://') && !output_url.startsWith('http://') && !output_url.startsWith('https://')) {
    // Convert path to file URL
    output_url = `file://${output_url}`;
  }
  
  // Validate the output URL
  try {
    await validateOutputUrl(output_url);
  } catch (error: any) {
    logger.warn(`Output URL validation failed: ${error.message}. Using default location.`);
    output_url = 'file://Review.md';
  }

  const { repository, requirements, depth, branch } = req.body;
  const repo_dir = fetchRepository(repository, branch);
  const review_start_commit = req.body.reviewStartCommit || 'HEAD~10';
  const review_end_commit = req.body.reviewEndCommit || 'HEAD';

  await emit({
    topic: 'review.requested',
    data: {
      repo_dir,
      branch,
      depth,
      review_start_commit,
      review_end_commit,
      requirements,
      timestamp: new Date().toISOString(),
      max_iterations: req.body.maxIterations || 100,
      exploration_constant: 1.414,
      max_depth: depth,
      output_url
    },
  });

  return { 
    status: 200, 
    body: { 
      message: 'Code review process initiated' 
    } 
  };
};

export const validateOutputUrl = async (outputUrl: string | undefined) => {
  if (!outputUrl) {
    outputUrl = 'file://Review.md';
  }
  
  try {
    const parsedOutputUrl = new URL(outputUrl);
    switch (parsedOutputUrl.protocol) {
      case 'file:':
        // Extract the path properly - for file:// URLs
        let filePath = parsedOutputUrl.pathname;
        
        // On Windows, the pathname starts with /, so for absolute paths, we should remove the leading /
        if (process.platform === 'win32' && filePath.startsWith('/')) {
          filePath = filePath.substring(1);
        }
        
        // Don't try to check existence of '/' directory
        if (filePath === '/') {
          // If path is just '/', use default file path instead
          filePath = path.join(process.cwd(), 'Review.md');
        } else if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          // Only throw an error if it's a file that exists
          if (stats.isFile()) {
            throw new Error(`Output file ${filePath} already exists`);
          }
        }
        break;
      case 'http:':
      case 'https:':
        const response = await fetch(outputUrl, { method: 'OPTIONS' });
        if (!response.ok || !response.headers.get('allow')?.includes('POST')) {
          throw new Error(`Output URL ${outputUrl} does not allow POST requests in its OPTIONS response`);  
        }
        break;
      default:
        throw new Error(`Invalid output URL: ${outputUrl}`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Invalid URL')) {
      // Handle the case where the URL is invalid
      throw new Error(`Invalid output URL format: ${outputUrl}`);
    }
    throw error;
  }
}

export const fetchRepository = (repository: string, branch: string) => {
  // If repository is a local path and exists, use it directly
  if (fs.existsSync(repository) && fs.statSync(repository).isDirectory()) {
    try {
      // Verify it's a git repository
      execSync('git rev-parse --is-inside-work-tree', { 
        cwd: repository,
        stdio: 'pipe'
      });
      
      // Check if branch exists and switch to it
      const currentBranch = execSync('git branch --show-current', { 
        cwd: repository,
        stdio: 'pipe' 
      }).toString().trim();
      
      if (currentBranch !== branch) {
        try {
          // Try to switch to the branch
          execSync(`git checkout ${branch}`, { 
            cwd: repository,
            stdio: 'pipe' 
          });
        } catch (error) {
          console.error(`Already on '${currentBranch}'`);
          // Continue with current branch if switch fails
        }
      }
      
      return repository;
    } catch (error) {
      // Not a git repository or other git error
      throw new Error(`${repository} is not a valid git repository: ${error}`);
    }
  }
  
  // If it's not a local path or doesn't exist, try to clone it
  const repoName = repository.split('/').pop()?.replace('.git', '') || 'repo';
  const clonePath = path.join(process.cwd(), 'tmp', repoName);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(path.dirname(clonePath))) {
    fs.mkdirSync(path.dirname(clonePath), { recursive: true });
  }
  
  try {
    // Check if repository already exists at clone path
    if (fs.existsSync(clonePath)) {
      // Pull latest changes
      execSync(`git -C ${clonePath} fetch --all`, { stdio: 'pipe' });
      execSync(`git -C ${clonePath} checkout ${branch}`, { stdio: 'pipe' });
      execSync(`git -C ${clonePath} pull origin ${branch}`, { stdio: 'pipe' });
    } else {
      // Clone repository
      execSync(`git clone --branch ${branch} ${repository} ${clonePath}`, { stdio: 'pipe' });
    }
    
    return clonePath;
  } catch (error) {
    throw new Error(`Failed to fetch repository ${repository}: ${error}`);
  }
}
