import { EventConfig, StepHandler } from '@motiadev/core';
import { z } from 'zod';

export const config: EventConfig = {
  type: 'event',
  name: 'Farcaster Monitor Trigger',
  subscribes: ['monitor.start'],
  emits: ['cast.stream.start'],
  input: z.object({
    keywords: z.array(z.string()),
  }),
  flows: ['farcaster'],
};

export const handler: StepHandler<typeof config> = async (input, context) => {
  const { emit, logger } = context;
  const { keywords } = input;

  logger.info('Triggering Farcaster stream', { keywords });

  // Emit the event to start the Farcaster stream

  emit({
    topic: 'cast.stream.start',
    data: { keywords },
  });
}; 