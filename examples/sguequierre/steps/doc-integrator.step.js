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
    
    // Debug logging
    logger.info(`Payload file: ${file}`);
    logger.info(`Content length: ${content ? content.length : 'undefined'}`);
    logger.info(`Number of gaps: ${gaps ? gaps.length : 'undefined'}`);
    
    let updatedContent = content;
    
    // Sort gaps to process them in reverse order (from bottom to top)
    // This prevents line number changes from affecting other insertions
    const sortedGaps = [...gaps].sort((a, b) => {
      const lineA = a.lineNumber || 0;
      const lineB = b.lineNumber || 0;
      return lineB - lineA;
    });
    
    // Debug logging for sorted gaps
    logger.info(`Sorted gaps: ${JSON.stringify(sortedGaps.map(g => g.lineNumber))}`);
    
    // Apply each documentation change
    for (const gap of sortedGaps) {
      logger.info(`Processing gap at line ${gap.lineNumber}: ${gap.type} ${gap.name}`);
      updatedContent = insertDocumentation(
        updatedContent, 
        gap.lineNumber, 
        gap.generated_doc
      );
    }
    
    // Writes to a local file
    const localPath = path.join('output', file);
    
    // Get absolute path for better debugging
    const absolutePath = path.resolve(localPath);
    
    logger.info(`Writing documentation to local file:`);
    logger.info(`- Relative path: ${localPath}`);
    logger.info(`- Absolute path: ${absolutePath}`);
    logger.info(`- Directory: ${path.dirname(absolutePath)}`);
    
    // Log current working directory
    logger.info(`Current working directory: ${process.cwd()}`);
    
    // Check if directory exists
    try {
      const dirStat = await fs.stat(path.dirname(localPath)).catch(() => null);
      logger.info(`Output directory exists: ${!!dirStat}`);
    } catch (e) {
      logger.info(`Error checking directory: ${e.message}`);
    }
    
    // Create directory with verbose logging
    logger.info(`Creating directory: ${path.dirname(localPath)}`);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    logger.info(`Directory created successfully`);
    
    // Write file with verbose logging
    logger.info(`Writing file: ${localPath}`);
    await fs.writeFile(localPath, updatedContent);
    logger.info(`File written successfully, size: ${updatedContent.length} bytes`);
    
    // Verify file was written
    try {
      const stats = await fs.stat(localPath);
      logger.info(`File verification - exists: true, size: ${stats.size} bytes`);
    } catch (e) {
      logger.info(`File verification failed: ${e.message}`);
    }
    
    emit({
      topic: "documentation-integrated",
      data: {
        file,
        updatedGapsCount: gaps.length,
        outputPath: absolutePath
      }
    });
    
    logger.info(`Documentation integration complete, emitted regular and virtual event`);
  } catch (error) {
    logger.error(`Error integrating documentation: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
  }
};

function insertDocumentation(content, lineNumber, docComment) {
  const lines = content.split('\n');
  lines.splice(lineNumber, 0, docComment);
  return lines.join('\n');
}