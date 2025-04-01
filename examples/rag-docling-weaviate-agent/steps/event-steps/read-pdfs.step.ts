import { readdir } from 'fs/promises';
import { join } from 'path';
import { EventConfig, FlowContext, StepHandler } from 'motia';
import { z } from 'zod';

const InputSchema = z.object({
  folderPath: z.string(),
});

export const config: EventConfig = {
  type: 'event',
  name: 'read-pdfs',
  flows: ['rag-workflow'],
  subscribes: ['rag.read.pdfs'],
  emits: [{ topic: 'rag.process.pdfs', label: 'Start processing PDFs' }],
  input: InputSchema,
};

export const handler: StepHandler<typeof config> = async (
  input: z.infer<typeof InputSchema>,
  { emit, logger }: FlowContext
) => {
  const { folderPath } = input;
  logger.info(`Reading PDFs from folder: ${folderPath}`);

  // Read all files in the directory
  const files = await readdir(folderPath);
  const pdfFiles = files.filter((file) => file.endsWith('.pdf'));

  logger.info(`Found ${pdfFiles.length} PDF files`);

  const filesInfo = await Promise.all(
    pdfFiles.map(async (pdfFile) => {
      const filePath = join(folderPath, pdfFile);
      return {
        filePath,
        fileName: pdfFile,
      };
    })
  );

  // Process PDF files in parallel
  /*await Promise.all(
    filesInfo.map(async (file) => {
      await emit({
        topic: 'rag.process.pdf',
        data: { files: [file] },
      });
    })
  );*/

  // Process PDF files sequentially
  await emit({
    topic: 'rag.process.pdfs',
    data: { files: filesInfo },
  });
};
