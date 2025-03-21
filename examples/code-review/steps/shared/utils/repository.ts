import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { MCTSControllerInput } from '../../code-review/controller.step';
import { InternalStateManager } from '@motiadev/core';

interface Remote {
  clone(path: string): Promise<void>;
  fetch(): Promise<void>;
  checkout(branch: string): Promise<void>;
}

class OctokitRemote implements Remote {
  constructor(public hostname: string, public repo: string) { }
  clone(path: string): Promise<void> { return Promise.resolve(); }
  fetch(): Promise<void> { return Promise.resolve(); }
  checkout(branch: string): Promise<void> { return Promise.resolve(); }
}

class GitRemote implements Remote {
  constructor(public hostname: string, public repo: string, public user: string | undefined) { }
  clone(path: string): Promise<void> { return Promise.resolve(); }
  fetch(): Promise<void> { return Promise.resolve(); }
  checkout(branch: string): Promise<void> { return Promise.resolve(); }
}

export class GitInterface {
  public url: URL;
  private remote: Remote | undefined;
  private fileSystemPath: string;

  private constructor(repoUrl: string, dummy: boolean = false) {
    this.url = new URL(repoUrl);
    this.fileSystemPath = path.join(process.cwd(), this.url.pathname);

    if (this.url.protocol && this.url.protocol !== 'file' && !this.url.pathname) {
      throw new Error('A remote repository must have a repo name');
    } else {
      this.fileSystemPath = path.join(process.cwd(), this.url.pathname.replace(/\.git$/, ''));
      if (this.url.protocol === 'gh') {
        const host = this.url.hostname || 'github.com';
        if (!dummy) {
          this.remote = new OctokitRemote(host, this.url.pathname);
        }
      } else {
        const hostname = this.url.hostname || 'localhost';
        const repoUrl = this.url.pathname.replace(/\/$/, '');
        if (!dummy) {
          this.remote = new GitRemote(hostname, repoUrl, this.url.username);
        }
      }
    }
  }

  static parseRepoUrl(repoUrl: string) {
    const git = new GitInterface(repoUrl, true);
    return git.url;
  }

  static async create(repoUrl: string, branch: string) {
    const git = new GitInterface(repoUrl);
    if (git.remote) {
      if (!fs.existsSync(git.fileSystemPath)) {
        await git.remote.clone(git.fileSystemPath);
      }
      await git.remote.fetch();
      await git.remote.checkout(branch);
    }
    if (!fs.existsSync(git.fileSystemPath)) {
      throw new Error('Repository does not exist');
    }
    return git;
  }

  // Add a constant for max diff size to prevent excessive memory usage
  private static readonly MAX_DIFF_SIZE = 1 * 1024 * 1024; // 1MB max diff size

  /**
   * Get the diff between two branches or commits with size limits
   * @param repoDir Path to local repository
   * @param base Base branch or commit
   * @param head Head branch or commit
   * @returns Git diff output, truncated if it exceeds max size
   */
  public getDiff(base: string, head: string): string {
    const fullDiff = execSync(`git diff ${base}..${head}`, { cwd: this.fileSystemPath }).toString();
    
    // If diff is too large, truncate it and add a warning
    if (fullDiff.length > GitInterface.MAX_DIFF_SIZE) {
      const truncatedDiff = fullDiff.substring(0, GitInterface.MAX_DIFF_SIZE);
      return truncatedDiff + `\n\n[WARNING: Diff truncated because it exceeded ${GitInterface.MAX_DIFF_SIZE / 1024}KB. Only showing first ${GitInterface.MAX_DIFF_SIZE / 1024}KB of changes.]\n`;
    }
    
    return fullDiff;
  }

  /**
   * Get commit messages between two commits with size limits
   * @param base Base branch or commit
   * @param head Head branch or commit
   * @returns Git log output with a limit on the number of commits
   */
  public getMessages(base: string, head: string): string {
    // Limit to the latest 20 commits if not otherwise specified
    const commitLimit = 20; 
    return execSync(`git log ${base}..${head} --pretty=format:"%h %s" --max-count=${commitLimit}`, { cwd: this.fileSystemPath }).toString();
  }

  /**
   * Get the list of files changed between commits with size limits
   * @param base Base branch or commit
   * @param head Head branch or commit
   * @returns List of changed files, truncated if too many
   */
  public getFiles(base: string, head: string): string {
    const fileLimit = 100; // Limit to 100 files
    return execSync(`git diff --name-only ${base}..${head} | head -n ${fileLimit}`, { cwd: this.fileSystemPath }).toString();
  }

  public resolveCommit(commit: string | undefined): string {
    if (!commit) {
      // If no commit is provided, get the first commit on this branch
      commit = execSync(`git rev-list --max-parents=0 HEAD`, { cwd: this.fileSystemPath }).toString();
    }
    return execSync(`git rev-parse ${commit}`, { cwd: this.fileSystemPath }).toString();
  }
}

export class Commits {
  public diff: string;
  public messages: string;
  public files: string;
  public history: {
    diff: string;
    messages: string;
    files: string;
  };

  private constructor(
    public repoUrl: string, 
    public branch: string, 
    public reviewStartCommit: string, 
    public reviewEndCommit: string, 
    public git: GitInterface
  ) {
    this.diff = this.git.getDiff(this.reviewStartCommit, this.reviewEndCommit);
    this.messages = this.git.getMessages(this.reviewStartCommit, this.reviewEndCommit);
    this.files = this.git.getFiles(this.reviewStartCommit, this.reviewEndCommit);
    this.history = {
      diff: this.diff,
      messages: this.messages,
      files: this.files,
    };
  }

  static async create(traceId: string, state: InternalStateManager, input: MCTSControllerInput) {
    const git = await GitInterface.create(input.repoUrl, input.branch);
    const reviewStartCommit = git.resolveCommit(input.reviewStartCommit);
    const reviewEndCommit = git.resolveCommit(input.reviewEndCommit);
    if (!reviewStartCommit || !reviewEndCommit) {
      throw new Error('Invalid review start or end commit');
    }
    return new Commits(input.repoUrl, input.branch, reviewStartCommit, reviewEndCommit, git);
  }
}
