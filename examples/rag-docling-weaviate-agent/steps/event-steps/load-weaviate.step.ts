import weaviate, { WeaviateClient, vectorizer, generative } from 'weaviate-client';
import { DocumentChunkType } from '../../types';
import { z } from 'zod';
import { EventConfig, StepHandler, FlowContext } from 'motia';

const InputSchema = z.object({
  stateKey: z.string(),
});

export const config: EventConfig = {
  type: 'event',
  name: 'load-weaviate',
  subscribes: ['rag.chunks.ready'],
  emits: [{ topic: 'rag.chunks.loaded', label: 'Chunks loaded in Weaviate' }],
  flows: ['rag-workflow'],
  input: InputSchema,
};

const WEAVIATE_SCHEMA = {
  name: 'Books',
  description: 'Books',
  vectorizers: vectorizer.text2VecOpenAI({
    model: 'text-embedding-3-small',
    sourceProperties: ['text'],
  }),
  generative: generative.openAI({
    model: 'gpt-4o-mini',
    maxTokens: 4096,
  }),
  properties: [
    {
      name: 'text',
      dataType: 'text' as const,
    },
    {
      name: 'title',
      dataType: 'text' as const,
    },
    {
      name: 'source',
      dataType: 'text' as const,
    },
    {
      name: 'page',
      dataType: 'number' as const,
    },
  ],
};

const collectionExists = async (client: WeaviateClient) => client.collections.get('Books').exists();
const deleteCollection = async (client: WeaviateClient) => client.collections.delete('Books');
const createCollection = async (client: WeaviateClient) =>
  client.collections.create(WEAVIATE_SCHEMA);

export const handler: StepHandler<typeof config> = async (
  input: z.infer<typeof InputSchema>,
  { emit, logger, state }: FlowContext
) => {
  // Get chunks from state
  const chunks = await state.get<DocumentChunkType[]>('rag-workflow', input.stateKey);
  if (!chunks) {
    throw new Error('No chunks found in state');
  }

  logger.info('Retrieved chunks from state', { count: chunks.length });
  logger.info('Initializing Weaviate client');

  // Initialize Weaviate client
  const client = await weaviate.connectToWeaviateCloud(process.env.WEAVIATE_URL!, {
    authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY!),
    headers: {
      'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY!,
      //"X-OpenAI-Organization": process.env.OPENAI_ORGANIZATION!,
    },
  });

  try {
    if (await collectionExists(client)) {
      logger.info('Collection "Books" already exists.');
      await deleteCollection(client);
    }

    await createCollection(client);

    // Process chunks in batches
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize).map((chunk: DocumentChunkType) => ({
        properties: {
          text: chunk.text,
          title: chunk.title,
          source: chunk.metadata.source,
          page: chunk.metadata.page,
        },
      }));

      // Insert batch
      const collection = client.collections.get('Books');
      await collection.data.insertMany(batch);
      logger.info(`Inserted batch ${i / batchSize + 1}`, { count: batch.length });
    }

    await emit({ topic: 'rag.chunks.loaded', data: { count: chunks.length } });
  } catch (error) {
    logger.error('Error in load-weaviate step', { error });
    throw error;
  } finally {
    await client.close();
  }
};
