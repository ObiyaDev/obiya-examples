import { EventConfig, StepHandler } from '@motiadev/core';
import { z } from 'zod';
import { Cast} from './types';

import OpenAI from 'openai';
// Configuration for the trend analysis step
export const config: EventConfig = {
  type: 'event',
  name: 'Trend Analysis',
  subscribes: ['cast.received'],
  emits: ['trend.analyzed'],
  input: z.object({
    minEngagement: z.number().default(5),
    timeWindow: z.number().default(3600), // 1 hour in seconds
    batchSize: z.number().default(10), // Number of casts to process at once
  }),
  flows: ['farcaster'],
};


export const handler: StepHandler<typeof config> = async (input, context) => {
  console.log('=== Starting Trend Analysis ===');
  const { emit } = context; 
  
  const casts = input.casts as Cast[];
  console.log('Received batch of casts:', casts);
    
  // ===== Periodic Analysis =====
  const analyzeTrends = async () => {
    console.log('\n=== Running Periodic Analysis ===');
   // console.log('Content map size:', contentMap.size);
  //Send content map to OpenAI and get summary
    console.log('Sending content map to OpenAI for summary...');

  const client = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
  });
  const trimmedBuffer = casts.map(cast => ({
    text: cast.text.slice(0, 200), // limit to 200 chars
    engagement: (cast.reactions?.likes_count || 0) + (cast.reactions?.recasts_count || 0),
    username: cast.author.username,
    created_at: cast.created_at
  }));

  console.log('Trimmed buffer:', trimmedBuffer);
    const openAiResponse = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: `Analyze the following social content for trending topics, repeated themes, or interesting user behavior:\n\n${JSON.stringify(trimmedBuffer, null, 2)}`,

        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });
    const openaiSummary = openAiResponse.choices[0].message.content;
    console.log('OpenAI summary:', openaiSummary);
  
    // Generate trends from content map
    console.log('\nGenerating trends from content map...');
    
    const result = {
      
      timestamp: new Date().toISOString(),
      summary: openaiSummary,
    }

    emit({
      topic: 'trend.analyzed',
      data: result
    });

    
  };

  // Run initial analysis
  await analyzeTrends();

  // Set up periodic analysis
  const analysisInterval = setInterval(analyzeTrends, 60000); // Analyze every minute

  // Cleanup on process exit
  process.on('SIGINT', () => {
    console.log('\nStopping trend analysis...');
    clearInterval(analysisInterval);
    process.exit(0);
  });
}; 