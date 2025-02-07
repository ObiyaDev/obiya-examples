import { ApiRouteConfig, StepHandler } from '@motiadev/core'
import { z } from 'zod'

const inputSchema = z.object({
    prompt: z.string(),
})

export const config: ApiRouteConfig = {
    type: 'api',
    name: 'generate image api trigger',
    description: 'generate an ai image given a prompt',
    path: '/generate-image',
    method: 'POST',
    emits: ['enhance-image-prompt'],
    bodySchema: inputSchema,
    flows: ['generate-image'],
}

export const handler: StepHandler<typeof config> = async (req, { logger, emit }) => {
    logger.info('initialized generate image flow', req.body)

    await emit({
        type: 'enhance-image-prompt',
        data: {
            prompt: req.body.prompt,
        },
    })

    return {
        status: 200,
        body: { message: `generate image flow initialized` },
    }
}