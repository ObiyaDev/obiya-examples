#!/usr/bin/env node

/**
 * CLI script to invoke the code review process from the command line
 * This script emits a review.requested event to the motia event system
 */

const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

// Default configuration
const DEFAULT_CONFIG = {
  requirements: 'Implement an MCTS-based workflow using motia and claude code agent',
  branch: 'main',
  depth: 2,
  reviewStartCommit: '',
  reviewEndCommit: 'HEAD~14',
  reviewMaxCommits: 14,
  maxIterations: 10,
  outputPath: path.join(process.cwd(), 'Review.md')
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsedArgs = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.substring(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        parsedArgs[key] = value;
        i++; // Skip the next argument as it's the value
      } else {
        parsedArgs[key] = 'true'; // Flag argument
      }
    }
  }
  
  return parsedArgs;
}

// Check if motia dev server is running
function checkMotiaDevServer() {
  try {
    // Attempt to make a simple request to check if dev server is running
    execSync('curl -s http://localhost:3000/health > /dev/null');
    return true;
  } catch (error) {
    return false;
  }
}

// Start motia dev server if not running
function startMotiaDevServer() {
  console.log('Starting Motia development server...');
  // Start the server in background
  execSync('npx motia dev > motia-dev.log 2>&1 &');
  
  // Wait for server to be ready
  console.log('Waiting for server to be ready...');
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    try {
      execSync('curl -s http://localhost:3000/health > /dev/null');
      console.log('Motia server is ready!');
      return true;
    } catch (error) {
      attempts++;
      // Wait 1 second before checking again
      execSync('sleep 1');
    }
  }
  
  console.error('Could not start Motia server after multiple attempts');
  return false;
}

// Main function
async function main() {
  try {
    console.log('Starting code review process...');
    
    // Check if Motia dev server is running
    const serverRunning = checkMotiaDevServer();
    if (!serverRunning) {
      const started = startMotiaDevServer();
      if (!started) {
        throw new Error('Could not start Motia development server');
      }
    }
    
    // Parse command line arguments
    const args = parseArgs();
    
    // Create event payload
    const payload = {
      repository: process.cwd(),
      branch: args.branch || DEFAULT_CONFIG.branch,
      requirements: args.requirements || DEFAULT_CONFIG.requirements,
      depth: parseInt(args.depth || DEFAULT_CONFIG.depth.toString()),
      reviewStartCommit: args.reviewStartCommit || DEFAULT_CONFIG.reviewStartCommit,
      reviewEndCommit: args.reviewEndCommit || DEFAULT_CONFIG.reviewEndCommit,
      reviewMaxCommits: parseInt(args.reviewMaxCommits || DEFAULT_CONFIG.reviewMaxCommits.toString()),
      maxIterations: parseInt(args.maxIterations || DEFAULT_CONFIG.maxIterations.toString()),
      outputPath: args.outputPath || DEFAULT_CONFIG.outputPath,
      timestamp: new Date().toISOString()
    };
    
    console.log('Review configuration:', JSON.stringify(payload, null, 2));
    
    // Prepare the payload
    const payloadStr = JSON.stringify(payload);
    
    // Emit the event using motia CLI
    console.log('Emitting review.requested event...');
    
    try {
      // Use child_process.spawn instead of execSync to avoid shell quoting issues
      const { spawnSync } = require('child_process');
      
      // Use the --message parameter with the JSON payload
      const result = spawnSync('npx', ['motia', 'emit', '--topic', 'review.requested', '--message', payloadStr], {
        stdio: 'inherit'
      });
      
      if (result.status === 0) {
        console.log('Review request emitted successfully.');
        console.log('Motia workflow has been initiated.');
        console.log(`The review will be written to: ${payload.outputPath}`);
        console.log('Please wait for the workflow to complete...');
      } else {
        throw new Error(`Command failed with exit code ${result.status}`);
      }
    } catch (error) {
      console.error('Error emitting review event:', error.message);
      throw new Error('Could not emit the review event');
    }
    
    // Poll for the output file to be created
    console.log('Waiting for the review to be generated...');
    let timeout = 300; // 5 minutes timeout
    const interval = 3; // Check every 3 seconds
    
    while (timeout > 0) {
      if (fs.existsSync(payload.outputPath)) {
        console.log(`\nReview completed! Output file created at: ${payload.outputPath}`);
        // Show a preview of the file
        const content = fs.readFileSync(payload.outputPath, 'utf8');
        const previewLength = Math.min(500, content.length);
        console.log('\nPreview of the review:');
        console.log('='.repeat(40));
        console.log(content.substring(0, previewLength) + (content.length > previewLength ? '...' : ''));
        console.log('='.repeat(40));
        return;
      }
      
      process.stdout.write('.');
      await new Promise(resolve => setTimeout(resolve, interval * 1000));
      timeout -= interval;
    }
    
    console.log('\nTimeout waiting for review file to be generated.');
    console.log('The workflow might still be running in the background.');
    console.log(`Check ${payload.outputPath} later to see if it completes.`);
  } catch (error) {
    console.error('Error initiating code review:', error);
    process.exit(1);
  }
}

main().catch(console.error); 