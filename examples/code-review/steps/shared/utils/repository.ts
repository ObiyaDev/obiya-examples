import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Interface for repository information
 */
export interface RepoInfo {
  owner: string;
  repo: string;
  url: string;
  branch: string;
}

/**
 * Parse repository URL into owner and repo name
 * @param repoUrl Repository URL (https or ssh format)
 * @returns Object containing owner and repo name
 */
export function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
  let match;
  
  // Handle https://github.com/owner/repo format
  match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  
  // Handle git@github.com:owner/repo.git format
  match = repoUrl.match(/github\.com:([^\/]+)\/([^\/\.]+)\.git/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  
  // Handle simple owner/repo format
  match = repoUrl.match(/^([^\/]+)\/([^\/]+)$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  
  throw new Error(`Could not parse repository URL: ${repoUrl}`);
}

/**
 * Clone a repository to a local directory
 * @param repoUrl Repository URL
 * @param branch Branch to clone
 * @param targetDir Target directory to clone into
 * @returns Path to the cloned repository
 */
export async function cloneRepository(
  repoUrl: string,
  branch: string = 'main',
  targetDir: string = './temp'
): Promise<string> {
  try {
    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const { owner, repo } = parseRepoUrl(repoUrl);
    const repoDir = path.join(targetDir, repo);
    
    // Clone the repository
    await execAsync(`git clone --branch ${branch} ${repoUrl} ${repoDir}`);
    
    return repoDir;
  } catch (error) {
    throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fetch repository file content using GitHub API
 * @param owner Repository owner
 * @param repo Repository name
 * @param path File path
 * @param branch Branch name
 * @param token GitHub access token (optional)
 * @returns File content
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  filePath: string,
  branch: string = 'main',
  token?: string
): Promise<string> {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3.raw'
    };
    
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }
    
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new Error(`File not found: ${filePath}`);
    }
    throw new Error(`Failed to fetch file content: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get a list of files in a repository
 * @param repoDir Path to local repository
 * @param extensions File extensions to filter by (optional)
 * @returns Array of file paths
 */
export async function listRepositoryFiles(
  repoDir: string,
  extensions?: string[]
): Promise<string[]> {
  try {
    // Use git to list all files tracked by git
    const { stdout } = await execAsync('git ls-files', { cwd: repoDir });
    
    let files = stdout.split('\n').filter(Boolean);
    
    // Filter by extensions if provided
    if (extensions && extensions.length > 0) {
      files = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return extensions.includes(ext);
      });
    }
    
    return files;
  } catch (error) {
    throw new Error(`Failed to list repository files: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get the diff between two branches or commits
 * @param repoDir Path to local repository
 * @param base Base branch or commit
 * @param head Head branch or commit
 * @returns Git diff output
 */
export async function getDiff(
  repoDir: string,
  base: string,
  head: string = 'HEAD'
): Promise<string> {
  try {
    const { stdout } = await execAsync(`git diff ${base}..${head}`, { cwd: repoDir });
    return stdout;
  } catch (error) {
    throw new Error(`Failed to get diff: ${error instanceof Error ? error.message : String(error)}`);
  }
} 