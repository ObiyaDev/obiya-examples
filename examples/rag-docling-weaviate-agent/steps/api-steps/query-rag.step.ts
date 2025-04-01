import { ApiRouteConfig, StepHandler, ApiRequest } from 'motia';
import weaviate from 'weaviate-client';
import { RAGResponseType } from '../../types';
import { z } from 'zod';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'query-rag',
  path: '/api/rag/query',
  method: 'POST',
  emits: ['rag.query.completed'],
  flows: ['rag-workflow'],
  bodySchema: z.object({
    query: z.string(),
    limit: z.number().optional().default(5),
  }),
};

export const handler: StepHandler<typeof config> = async (req: ApiRequest, { logger, emit }) => {
  const { query, limit } = req.body;

  logger.info('Processing RAG query', { query, limit });

  // Initialize Weaviate client
  const client = await weaviate.connectToWeaviateCloud(process.env.WEAVIATE_URL!, {
    authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY!),
    headers: {
      'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY!,
      //"X-OpenAI-Organization": process.env.OPENAI_ORGANIZATION!,
    },
  });

  try {
    // Get collection reference
    const documentCollection = client.collections.get('Books');

    // Query using v3 syntax
    const result = await documentCollection.generate.nearText(
      query,
      {
        singlePrompt: `Answer the following question using only the provided context: ${query}`,
      },
      {
        limit: limit,
        returnProperties: ['text', 'title', 'source', 'page'],
        returnMetadata: ['distance'],
      }
    );

    const chunks = result.objects.map((doc) => ({
      text: doc.properties.text as string,
      title: doc.properties.title as string,
      metadata: {
        source: doc.properties.source as string,
        page: doc.properties.page as number,
      },
    }));

    const answer = result.objects[0]?.generated || 'No answer generated';

    const response: RAGResponseType = {
      query,
      answer,
      chunks,
    };

    await emit({
      topic: 'rag.query.completed',
      data: response,
    });

    return {
      status: 200,
      body: response,
    };
  } catch (error) {
    logger.error('Error querying Weaviate', { error });
    return {
      status: 500,
      body: {
        error: 'Failed to process RAG query',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
};
