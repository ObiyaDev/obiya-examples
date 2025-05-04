// steps/human-review-ui.step.ts
// NEEDS WORK TO IMPLEMENT REAL UI
import { createServer } from 'http';

interface DocReviewPayload {
  file: string;
  content: string;
  gaps: Array<{
    type: string;
    name: string;
    issue: string;
    generated_doc: string;
    lineNumber?: number;
  }>;
}

// Configuration section
export const config = {
  type: 'event',
  name: 'human-review-ui',
  subscribes: ['documentation-generated'],
  emits: ['documentation-approved'],
  flows: ['documentation-guardian']
};

// Handler function
export const handler = async (payload: DocReviewPayload, context: any) => {
  const { emit, logger } = context;
  logger.info(`Preparing review UI for ${payload.file}`);
  
  // Find line numbers for each gap
  const lines = payload.content.split('\n');
  const gapsWithLineNumbers = payload.gaps.map(gap => {
    const pattern = new RegExp(`${gap.type}\\s+${gap.name}`);
    
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        return { ...gap, lineNumber: i };
      }
    }
    
    return gap;
  });
  
  // In a real implementation, you would:
  // 1. Create a pull request with the changes
  // 2. Or use a web UI for approval
  
  // For this example, we'll use a simple HTTP server
  // That presents the changes and waits for approval
  const server = createServer((req, res) => {
    if (req.url === '/approve') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('Changes approved!');
      
      // Close the server and emit approval event
      server.close();
      emit({
        topic: "documentation-approved",
        data: {
          ...payload,
          gaps: gapsWithLineNumbers
        }
      });
      return;
    }
    
    // Render a simple UI for review
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head>
          <title>Documentation Review</title>
          <style>
            body { font-family: sans-serif; margin: 20px; }
            pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
            .doc-item { margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; }
            .approve-btn { background: green; color: white; padding: 10px 20px; border: none; cursor: pointer; }
          </style>
        </head>
        <body>
          <h1>Documentation Review: ${payload.file}</h1>
          <div>
            ${gapsWithLineNumbers.map((gap, i) => `
              <div class="doc-item">
                <h3>${gap.type}: ${gap.name}</h3>
                <p>Issue: ${gap.issue}</p>
                <p>Line number: ${gap.lineNumber || 'Unknown'}</p>
                <h4>Generated Documentation:</h4>
                <pre>${gap.generated_doc}</pre>
              </div>
            `).join('')}
          </div>
          <button class="approve-btn" onclick="window.location.href='/approve'">Approve All Changes</button>
        </body>
      </html>
    `);
  });
  
  server.listen(3001, () => {
    logger.info('Review UI available at http://localhost:3001');
  });
  
  // In a real implementation, you'd have a timeout and error handling
};