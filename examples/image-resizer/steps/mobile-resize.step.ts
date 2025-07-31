import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import sharp from 'sharp'
import { dirname } from 'path'
import type { ImageMetadata } from '../shared/interfaces'
import { 
  getResizedImagePath,
  ensureDirectoryExists,
  getResizeConfig,
  validateFileExists,
  createSafeErrorMessage,
  buildLogContext
} from '../shared/utils'

export const config: EventConfig = {
  type: 'event',
  name: 'MobileResize',
  description: 'Resize uploaded image for mobile viewing (720px width)',

  /**
   * Subscribe to image-saved events from the upload step
   */
  subscribes: ['image-saved'],

  /**
   * Emit mobile-resize-complete event when processing is done
   */
  emits: ['mobile-resize-complete'],

  /** 
   * Expected event data schema - ImageMetadata from upload step
   */
  input: z.object({
    originalFilename: z.string(),
    uniqueFilename: z.string(),
    format: z.enum(['jpeg', 'png', 'webp']),
    originalPath: z.string(),
    traceId: z.string(),
    uploadedAt: z.string().or(z.date())
  }),

  /**
   * The flows this step belongs to, will be available in Workbench
   */
  flows: ['image-processing'],
}

export const handler: Handlers['MobileResize'] = async (input, { logger, emit, traceId }) => {
  const startTime = Date.now()
  
  try {
    const imageMetadata = input as ImageMetadata

    const logContext = buildLogContext({ 
      step: 'MobileResize',
      originalFilename: imageMetadata.originalFilename,
      uniqueFilename: imageMetadata.uniqueFilename,
      originalPath: imageMetadata.originalPath,
      traceId 
    })

    logger.info('Mobile Resize Step – Starting mobile resize operation', logContext)

    // Validate input file exists and is readable
    try {
      validateFileExists(imageMetadata.originalPath)
      
      const validationContext = buildLogContext(logContext, { 
        fileValidation: 'passed',
        inputFile: imageMetadata.originalPath
      })
      logger.info('Mobile Resize Step – Input file validation passed', validationContext)
      
    } catch (validationError) {
      const safeError = createSafeErrorMessage(validationError, 'Input file validation failed')
      const errorContext = buildLogContext(logContext, { 
        validationError: safeError.message,
        errorType: 'input_validation'
      })
      
      logger.error('Mobile Resize Step – Input file validation failed', errorContext)
      throw new Error(`Input validation failed: ${safeError.message}`)
    }

    // Get resize configuration for mobile with error handling
    let resizeConfig: { width: number; quality?: number }
    let mobilePath: string
    
    try {
      resizeConfig = getResizeConfig('mobile')
      mobilePath = getResizedImagePath(imageMetadata.uniqueFilename, 'mobile')

      const configContext = buildLogContext(logContext, { 
        targetWidth: resizeConfig.width,
        outputPath: mobilePath,
        configLoaded: 'success'
      })
      logger.info('Mobile Resize Step – Configuration loaded', configContext)
      
    } catch (configError) {
      const safeError = createSafeErrorMessage(configError, 'Configuration loading failed')
      const errorContext = buildLogContext(logContext, { 
        configError: safeError.message,
        errorType: 'config_loading'
      })
      
      logger.error('Mobile Resize Step – Failed to load configuration', errorContext)
      throw new Error(`Configuration failed: ${safeError.message}`)
    }

    // Ensure output directory exists with enhanced error handling
    try {
      ensureDirectoryExists(dirname(mobilePath))
      
      const dirContext = buildLogContext(logContext, { 
        outputDirectory: dirname(mobilePath),
        directoryCreation: 'success'
      })
      logger.info('Mobile Resize Step – Output directory verified/created', dirContext)
      
    } catch (dirError) {
      const safeError = createSafeErrorMessage(dirError, 'Directory creation failed')
      const errorContext = buildLogContext(logContext, { 
        directoryError: safeError.message,
        errorType: 'directory_creation',
        targetDirectory: dirname(mobilePath)
      })
      
      logger.error('Mobile Resize Step – Failed to create output directory', errorContext)
      throw new Error(`Directory preparation failed: ${safeError.message}`)
    }

    // Perform image resize using Sharp with enhanced error handling
    try {
      const sharpStartTime = Date.now()
      
      // Create Sharp instance with error handling
      const sharpInstance = sharp(imageMetadata.originalPath)
      
      // Get image metadata for validation and logging
      const metadata = await sharpInstance.metadata()
      
      const metadataContext = buildLogContext(logContext, { 
        inputWidth: metadata.width,
        inputHeight: metadata.height,
        inputFormat: metadata.format,
        inputSize: metadata.size,
        targetWidth: resizeConfig.width
      })
      logger.info('Mobile Resize Step – Input image metadata retrieved', metadataContext)
      
      // Validate image dimensions
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image: missing width or height information')
      }
      
      if (metadata.width < 1 || metadata.height < 1) {
        throw new Error(`Invalid image dimensions: ${metadata.width}x${metadata.height}`)
      }

      // Perform the resize operation
      await sharpInstance
        .resize({
          width: resizeConfig.width,
          height: undefined, // Maintain aspect ratio
          fit: 'inside',
          withoutEnlargement: true // Don't upscale smaller images
        })
        .toFile(mobilePath)

      const processingTime = Date.now() - sharpStartTime

      const successContext = buildLogContext(logContext, { 
        originalPath: imageMetadata.originalPath,
        mobilePath,
        targetWidth: resizeConfig.width,
        processingTimeMs: processingTime,
        inputDimensions: `${metadata.width}x${metadata.height}`,
        sharpProcessing: 'success'
      })
      logger.info('Mobile Resize Step – Successfully resized image for mobile', successContext)

    } catch (sharpError) {
      const safeError = createSafeErrorMessage(sharpError, 'Sharp processing failed')
      const errorContext = buildLogContext(logContext, { 
        sharpError: safeError.message,
        errorType: 'sharp_processing',
        inputPath: imageMetadata.originalPath,
        outputPath: mobilePath,
        targetWidth: resizeConfig.width
      })
      
      logger.error('Mobile Resize Step – Sharp processing failed', errorContext)
      
      // Provide more specific error messages based on Sharp error types
      let errorMessage = safeError.message
      if (sharpError instanceof Error) {
        if (sharpError.message.includes('Input file is missing')) {
          errorMessage = 'Input image file not found or inaccessible'
        } else if (sharpError.message.includes('Input file contains unsupported image format')) {
          errorMessage = 'Unsupported or corrupted image format'
        } else if (sharpError.message.includes('Input buffer contains unsupported image format')) {
          errorMessage = 'Invalid or corrupted image data'
        } else if (sharpError.message.includes('Unable to save')) {
          errorMessage = 'Failed to save resized image - check disk space and permissions'
        }
      }
      
      throw new Error(`Sharp resize operation failed: ${errorMessage}`)
    }

    // Prepare completion event data with enhanced logging
    const completionData = {
      ...imageMetadata,
      resizeType: 'mobile' as const,
      outputPath: mobilePath,
      targetWidth: resizeConfig.width,
      completedAt: new Date(),
      traceId
    }

    const completionContext = buildLogContext(logContext, { 
      completionData: {
        ...completionData,
        completedAt: completionData.completedAt.toISOString()
      },
      eventPreparation: 'success'
    })
    logger.info('Mobile Resize Step – Completion event data prepared', completionContext)

    // Emit mobile-resize-complete event with enhanced error handling
    try {
      await emit({
        topic: 'mobile-resize-complete',
        data: {
          ...completionData,
          uploadedAt: typeof completionData.uploadedAt === 'string' ? completionData.uploadedAt : completionData.uploadedAt.toISOString(),
          completedAt: completionData.completedAt.toISOString()
        },
      })
      
      const emitContext = buildLogContext(logContext, { 
        eventTopic: 'mobile-resize-complete',
        eventEmission: 'success',
        resizeType: 'mobile'
      })
      logger.info('Mobile Resize Step – Successfully emitted mobile-resize-complete event', emitContext)
      
    } catch (emitError) {
      const safeError = createSafeErrorMessage(emitError, 'Event emission failed')
      const errorContext = buildLogContext(logContext, { 
        emitError: safeError.message,
        errorType: 'event_emission',
        eventTopic: 'mobile-resize-complete'
      })
      
      logger.error('Mobile Resize Step – Failed to emit mobile-resize-complete event', errorContext)
      throw new Error(`Failed to emit completion event: ${safeError.message}`)
    }

    // Calculate total processing time and log final success
    const totalProcessingTime = Date.now() - startTime
    const finalContext = buildLogContext(logContext, { 
      originalFilename: imageMetadata.originalFilename,
      mobilePath,
      totalProcessingTimeMs: totalProcessingTime,
      operationSuccess: true,
      resizeType: 'mobile'
    })
    
    logger.info('Mobile Resize Step – Mobile resize operation completed successfully', finalContext)

  } catch (error) {
    const totalProcessingTime = Date.now() - startTime
    const safeError = createSafeErrorMessage(error, 'Mobile resize operation failed')
    const errorContext = buildLogContext({ 
      step: 'MobileResize',
      traceId,
      totalProcessingTimeMs: totalProcessingTime,
      operationError: safeError.message,
      errorType: 'operation_failure',
      imageMetadata: input
    })
    
    logger.error('Mobile Resize Step – Unexpected error during mobile resize', errorContext)

    // Re-throw the error to mark the step as failed in Motia Workbench
    // Ensure the error message is informative for debugging
    if (error instanceof Error) {
      throw error
    } else {
      throw new Error(`Mobile resize failed: ${safeError.message}`)
    }
  }
}