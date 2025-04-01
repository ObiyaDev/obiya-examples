import { ApiRequest, ApiRouteConfig, FlowContext, StepHandler } from 'motia';
import { z } from 'zod';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'trigger-pdf-processing',
  path: '/api/rag/process-pdfs',
  method: 'POST',
  emits: [{ topic: 'rag.read.pdfs', label: 'Start reading PDFs' }],
  flows: ['rag-workflow'],
  bodySchema: z.object({
    folderPath: z.string(),
  }),
};

export const handler: StepHandler<typeof config> = async (
  req: ApiRequest,
  { emit, logger }: FlowContext
) => {
  const { folderPath } = req.body;

  logger.info('Starting PDF processing workflow', { folderPath });

  await emit({
    topic: 'rag.read.pdfs',
    data: { folderPath },
  });

  return {
    status: 200,
    body: {
      message: 'PDF processing workflow started',
      folderPath,
    },
  };
};
