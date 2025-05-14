import { StepHandler, ApiRouteConfig } from '@motiadev/core';
import { z } from 'zod';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'Start Farcaster Monitor',
  method: 'POST',
  path: '/start-monitor',
  
  emits: ['monitor.start'],
  flows: ['farcaster'],
} as const;

export const handler = async (input: { keywords?: string[] }, context: any) => {
  const { emit, logger } = context;
  const { keywords = ['the', 'my', 'gm', 'gn', 'and'] } = input;

  logger.info('Starting Farcaster monitor', { keywords });

  emit({
    topic: 'monitor.start',
    data: { keywords },
  });

  return {
    status: 200,
    body: {
      message: 'Farcaster monitor started',
      keywords,
    },
  };
}; 