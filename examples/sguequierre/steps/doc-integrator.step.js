// steps/doc-integrator.step.js
const fs = require('fs').promises;
const path = require('path');

exports.config = {
  type: 'event',
  name: 'doc-integrator',
  subscribes: ['documentation-approved'],
  emits: ['documentation-integrated'],
  flows: ['documentation-guardian']
};

exports.handler = async (payload, context) => {
  const { emit, logger } = context;
  logger.info(`Integrating documentation for ${payload.file}`);
  
  try {
    const { file, content, gaps } = payload;
    let updatedContent = content;
    
    // Sort gaps to process them in reverse order (from bottom to top)
    // This prevents line number changes from affecting other insertions
    const sortedGaps = [...gaps].sort((a, b) => {
      const lineA = a.lineNumber || 0;
      const lineB = b.lineNumber || 0;
      return lineB - lineA;
    });
    
    // Apply each documentation change
    for (const gap of sortedGaps) {
      updatedContent = insertDocumentation(
        updatedContent, 
        gap.lineNumber, 
        gap.generated_doc
      );
    }
    
    // In a real implementation, you'd commit this back to the repository
    // Here we'll just demonstrate writing to a local file
    const localPath = path.join('output', file);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, updatedContent);
    
    emit({
      topic: "documentation-integrated",
      data: {
        file,
        updatedGapsCount: gaps.length
      }
    });
  } catch (error) {
    logger.error(`Error integrating documentation: ${error.message}`);
  }
};

function insertDocumentation(content, lineNumber, docComment) {
  const lines = content.split('\n');
  lines.splice(lineNumber, 0, docComment);
  return lines.join('\n');
}