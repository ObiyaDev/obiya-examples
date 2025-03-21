#!/usr/bin/env node

/**
 * CLI script to invoke the code review process from the command line
 * This script emits a review.requested event to the motia event system
 */

const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');
const http = require('http');

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

// Emit an event directly via HTTP to avoid command line escaping issues
async function emitEvent(topic, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      topic,
      data
    });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/events',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (e) {
            resolve({ success: true, data });
          }
        } else {
          reject(new Error(`HTTP error ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(payload);
    req.end();
  });
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
      repoUrl: process.cwd(),
      branch: args.branch || DEFAULT_CONFIG.branch,
      requirements: args.requirements || DEFAULT_CONFIG.requirements,
      depth: parseInt(args.depth || DEFAULT_CONFIG.depth.toString()),
      reviewStartCommit: args.reviewStartCommit || DEFAULT_CONFIG.reviewStartCommit,
      reviewEndCommit: args.reviewEndCommit || DEFAULT_CONFIG.reviewEndCommit,
      reviewMaxCommits: parseInt(args.reviewMaxCommits || DEFAULT_CONFIG.reviewMaxCommits.toString()),
      maxIterations: parseInt(args.maxIterations || DEFAULT_CONFIG.maxIterations.toString()),
      outputPath: args.outputPath || DEFAULT_CONFIG.outputPath,
      timestamp: new Date().toISOString(),
      prompt: args.requirements || DEFAULT_CONFIG.requirements
    };
    
    console.log('Review configuration:', JSON.stringify(payload, null, 2));
    
    // Emit the event using motia CLI
    console.log('Emitting review.requested event...');
    
    // Save payload to a temporary file
    const tempFile = path.join(process.cwd(), '.temp-payload.json');
    fs.writeFileSync(tempFile, JSON.stringify(payload));
    
    // Create a minimal payload to reduce command line length and avoid special characters
    const minimalPayload = {
      repository: payload.repository,
      repoUrl: payload.repoUrl,
      branch: payload.branch,
      requirements: payload.requirements,  // Use the full requirements
      reviewStartCommit: payload.reviewStartCommit,
      reviewEndCommit: payload.reviewEndCommit,
      outputPath: payload.outputPath,
      prompt: payload.prompt,  // Use the full prompt
      maxIterations: payload.maxIterations,
      depth: payload.depth
    };
    
    // Convert to JSON without any special characters
    // Handle escaping in a more robust way
    let jsonPayload = JSON.stringify(minimalPayload);
    jsonPayload = jsonPayload.replace(/"/g, '\\"');  // Escape double quotes
    jsonPayload = jsonPayload.replace(/'/g, "\\'");  // Escape single quotes
    
    try {
      // Execute the command with properly wrapped JSON
      execSync(`npx motia emit --topic review.requested --message "${jsonPayload}"`, {
        stdio: 'inherit'
      });
      console.log('Event emitted successfully');
    } catch (error) {
      console.error('Error emitting event:', error.message);
      throw error;
    }
    
    console.log('Review request emitted. Motia workflow has been initiated.');
    console.log(`The review will be written to: ${payload.outputPath}`);
    console.log('Please wait for the workflow to complete...');
    
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