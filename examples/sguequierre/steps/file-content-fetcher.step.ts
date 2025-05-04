// steps/file-content-fetcher.step.ts
import axios from 'axios';

interface FileChangePayload {
  repository: string;
  file: string;
  commitSha: string;
}

// Configuration section
export const config = {
  type: 'event',
  name: 'file-content-fetcher',
  subscribes: ['code-file-changed'],
  emits: ['file-content-fetched'],
  flows: ['documentation-guardian']
};

// Handler function
export const handler = async (payload: FileChangePayload, context: any) => {
  const { emit, logger } = context;
  logger.info(`Fetching content for ${payload.file}`);
  
  try {
    // This is a simplified example - you'd use GitHub API or similar
    // You'll need to add authentication and proper API usage
    const response = await axios.get(
      `https://api.github.com/repos/${payload.repository}/contents/${payload.file}`,
      { headers: { 'Accept': 'application/vnd.github.v3.raw' } }
    );
    
    emit({
      topic: "file-content-fetched",
      data: {
        ...payload,
        content: response.data
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error fetching file content: ${error.message}`);
    } else {
      logger.error('Error fetching file content: An unknown error occurred.');
    }
  }
};