import { z } from 'zod'
import axios from 'axios'

const traceId = process.env.TRACE_ID
const devToApiKey = process.env.DEVTO_API_KEY

exports.config = {
  type: 'api',
  name: 'fetch devto articles',
  emits: ['article.submitted'],
  flows: ['content-pipeline'],
  path: '/get-last-published-article',
  method: 'GET',
  description: 'Returns the last published article from DevTo',
  responseSchema: {
    200: z.object({
      message: z.string(),
    }),
  },
}
 
exports.handler = async (req, { emit, logger, state, traceId }) => {
  logger.info('Get last published article endpoint was called')
 

const list =  await axios.get('https://dev.to/api/articles/me/published?page=1&per_page=1', {
  headers: {
    "api-key": devToApiKey,
  }
});



const lastId = await state.get(traceId,'lastPublishedArticle')

if(lastId===list.data[0].id) {
  logger.info('No new articles found, skipping emit')
  return {
    status: 200,
    body: { message: 'No new articles found' },
  }
}else{
  logger.info('New article found, proceeding with emit')
  await state.clear(traceId, 'lastPublishedArticle')
  await state.set(traceId, 'lastPublishedArticle', list.data[0].id)

  await emit({
     topic: 'article.submitted',
     data: {
       body: list.data[0].body_markdown
     }
   })
}

  return {
    status: 200,
    body: { message: 'API step ran successfully', traceId },
  }
}