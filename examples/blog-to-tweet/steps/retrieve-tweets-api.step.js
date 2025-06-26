const { z } = require('zod')

exports.config = {
  type: 'api',
  name: 'retrieve-tweets-api',
  path: '/retrieve-tweets/:traceId',
  emits:[],
  flows: ['content-pipeline'],
  method: 'GET',
  description: 'Returns a simple greeting message.',
  responseSchema: {
    200: z.object({
      message: z.array(z.object({
        type: z.enum(['classic', 'listicle', 'quote']),
        tweet: z.string().max(280),
        reason: z.string(),
      }))
    }),
  },
}

exports.handler = async (req, { logger, state}) => {
  logger.info('Retrieve endpoint was called')

  const tweets = await state.get(req.pathParams.traceId, 'tweets')

  return {
    status: 200,
    body: { message: tweets },
  }
}