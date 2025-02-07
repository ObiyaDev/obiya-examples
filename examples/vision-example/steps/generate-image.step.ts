import { EventConfig, StepHandler } from '@motiadev/core'
import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

type Input = typeof inputSchema

const inputSchema = z.object({prompt: z.string()})

export const config: EventConfig<Input> = {
    type: 'event',
    name: 'generate image',
    description: 'generate an ai image given a prompt',
    subscribes: ['generate-image'],
    emits: ['evaluate-image'],
    input: inputSchema,
    flows: ['generate-image'],
}

const getRequestStatus = async (statusUrl: string) => {
  const requestStatus = await fetch(statusUrl, {
    headers: {
      'Authorization': `Key ${process.env.FAL_API_KEY}`,
    },
  }).then(res => res.json());
  
  if (!['IN_QUEUE', 'IN_PROGRESS'].includes(requestStatus.status)) {
    return requestStatus.status;
  }

  await new Promise(resolve => setTimeout(resolve, 1000));
  return getRequestStatus(statusUrl);
}

export const handler: StepHandler<typeof config> = async (input, { traceId, logger, state, emit }) => {
  logger.info('generate an image using flux')

  const response = await fetch('https://queue.fal.run/fal-ai/flux-pro/new', {
      method: 'POST',
      headers: {
          'Authorization': `Key ${process.env.FAL_API_KEY}`,
          'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          prompt: input.prompt,
          image_size: 'square_hd',
          sync_mode: true,
      }),
  })
  
  if (response.ok) {
      const data = await response.json();

      if (data.status === 'IN_QUEUE') {
        const status = await getRequestStatus(data.status_url);
        logger.info("REQUEST STATUS", status);

        if (status !== 'COMPLETED') {
          logger.error("IMAGE NOT GENERATED", {status});
          return;
        }
      }

      logger.info("REQUESTING IMAGE RESULT", data);

      const result = await fetch(data.response_url, {
        headers: {
          'Authorization': `Key ${process.env.FAL_API_KEY}`,
        },
      }).then(res => res.text());
      

      logger.info('generated image', result)
      // const buffer = Buffer.from(await blob.arrayBuffer());
      // const base64Image = buffer.toString('base64');
      
      // await emit({
      //     type: 'evaluate-image',
      //     data: { image: base64Image },
      // })
      
  } else {
      logger.error('failed to generate image', response)
  }
}