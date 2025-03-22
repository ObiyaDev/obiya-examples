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
  outputUrl: z.string().optional().default('file://../..').describe('The URL to save the review file. Defaults to the current directory.')
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
  await validateOutputUrl(req.body.outputUrl);

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
      max_iterations: 100,
      exploration_constant: 1.414,
      max_depth: depth,
      output_url: req.body.outputUrl
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
        if (filePath !== '/' && fs.existsSync(filePath)) {
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
  
  return outputUrl;
}

export const fetchRepository = (repository: string, branch: string) => {
  try {
    const repoUrl = new URL(repository);
    const repoDir = path.join(process.cwd(), '.motia', 'git', repoUrl.pathname);

    if (repoUrl.protocol === 'gh:') {
      throw new Error('Octokit not supported yet');
    }
    if (!fs.existsSync(repoDir)) {
      execSync(`git clone ${repository} ${repoDir}`);
    }
    
    // Checkout the specified branch
    execSync(`git checkout ${branch}`, { cwd: repoDir });
    
    // Try to pull, but continue even if it fails
    try {
      execSync(`git pull`, { cwd: repoDir });
    } catch (pullError: any) {}

    return repoDir;
  } catch (error: any) {
    // Handle local repositories (file paths)
    if (error instanceof TypeError && (error as any).code === 'ERR_INVALID_URL') {
      const repoDir = repository;
      
      // Verify it's a directory that exists
      if (!fs.existsSync(repoDir)) {
        throw new Error(`Repository directory not found: ${repoDir}`);
      }
      
      // Try to checkout the specified branch
      try {
        execSync(`git checkout ${branch}`, { cwd: repoDir });
      } catch (checkoutError: any) {
        throw new Error(`Failed to checkout branch ${branch}: ${checkoutError.message}`);
      }
      
      return repoDir;
    }
    
    throw error;
  }
}
