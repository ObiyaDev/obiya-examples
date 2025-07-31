import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import sharp from 'sharp'
import type { ImageMetadata, ResizeCompletionData } from '../shared/interfaces'
import {
  generateStorageKeys,
  getImageFromStorage,
  saveImageToStorage,
  getImageUrl,
  getResizeConfig,
  createSafeErrorMessage,
  buildLogContext
} from '../shared/storage-utils'

export const config: EventConfig = {
  type: 'event',
  name: 'DesktopResize',
  description: 'Resize uploaded image for desktop viewing (1920px width)',

  subscribes: ['image-saved'],
  emits: ['desktop-resize-complete'],

  input: z.object({
    originalFilename: z.string(),
    uniqueFilename: z.string(),
    format: z.enum(['jpeg', 'png', 'webp']),
    originalStorageKey: z.string(),
    originalUrl: z.string(),
    traceId: z.string(),
    uploadedAt: z.string().or(z.date())
  }),

  flows: ['image-processing'],
}

export const handler: Handlers['DesktopResize'] = async (imageMetadata, { logger, emit, traceId }) => {
  const startTime = Date.now()

  try {
    const logContext = buildLogContext({ 
      step: 'DesktopResize',
      originalFilename: imageMetadata.originalFilename,
      uniqueFilename: imageMetadata.uniqueFilename,
      originalStorageKey: imageMetadata.originalStorageKey,
      traceId 
    })

    logger.info('Desktop Resize Step – Starting desktop resize operation', logContext)

    // Get storage keys and resize config
    const storageKeys = generateStorageKeys(imageMetadata.uniqueFilename)
    const resizeConfig = getResizeConfig('desktop')

    // Get original image from storage
    const originalBuffer = await getImageFromStorage(imageMetadata.originalStorageKey)
    
    logger.info('Desktop Resize Step – Retrieved original image from storage', {
      ...logContext,
      bufferSize: originalBuffer.length
    })

    // Perform resize operation
    const resizedBuffer = await sharp(originalBuffer)
      .resize(resizeConfig.width, null, { 
        withoutEnlargement: true,
        fit: 'inside'
      })
      .jpeg({ quality: resizeConfig.quality || 90 })
      .toBuffer()

    logger.info('Desktop Resize Step – Resize operation completed', {
      ...logContext,
      originalSize: originalBuffer.length,
      resizedSize: resizedBuffer.length,
      targetWidth: resizeConfig.width
    })

    // Save resized image to storage
    const outputStorageKey = await saveImageToStorage(resizedBuffer, storageKeys.desktop)
    const outputUrl = getImageUrl(outputStorageKey)

    // Create completion data
    const completionData: ResizeCompletionData = {
      ...imageMetadata,
      resizeType: 'desktop',
      outputStorageKey,
      outputUrl,
      completedAt: new Date()
    }

    // Emit completion event
    await emit({
      topic: 'desktop-resize-complete',
      data: {
        ...completionData,
        uploadedAt: typeof completionData.uploadedAt === 'string' 
          ? completionData.uploadedAt 
          : completionData.uploadedAt.toISOString(),
        completedAt: completionData.completedAt.toISOString()
      },
    })

    const totalTime = Date.now() - startTime
    logger.info('Desktop Resize Step – Desktop resize completed successfully', {
      ...logContext,
      outputStorageKey,
      outputUrl,
      processingTimeMs: totalTime
    })

  } catch (error) {
    const totalTime = Date.now() - startTime
    const safeError = createSafeErrorMessage(error, 'Desktop resize failed')
    
    logger.error('Desktop Resize Step – Desktop resize operation failed', {
      ...buildLogContext({
        step: 'DesktopResize',
        originalFilename: imageMetadata.originalFilename,
        traceId,
        processingTimeMs: totalTime,
        error: safeError.message
      })
    })

    throw new Error(`Desktop resize failed: ${safeError.message}`)
  }
}