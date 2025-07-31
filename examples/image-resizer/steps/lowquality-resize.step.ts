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
  name: 'LowQualityResize',
  description: 'Resize uploaded image for low-quality/compressed viewing (480px width, 60% quality)',

  /**
   * Subscribe to image-saved events from the upload step
   */
  subscribes: ['image-saved'],

  /**
   * Emit lowquality-resize-complete event when processing is done
   */
  emits: ['lowquality-resize-complete'],

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

export const handler: Handlers['LowQualityResize'] = async (input, { logger, emit, traceId }) => {
  const startTime = Date.now()
  
  try {
    const imageMetadata = input as ImageMetadata

    const logContext = buildLogContext({ 
      step: 'LowQualityResize',
      originalFilename: imageMetadata.originalFilename,
      uniqueFilename: imageMetadata.uniqueFilename,
      originalPath: imageMetadata.originalPath,
      traceId 
    })

    logger.info('Low-Quality Resize Step – Starting low-quality resize operation', logContext)

    // Validate input file exists and is readable
    try {
      validateFileExists(imageMetadata.originalPath)
      
      const validationContext = buildLogContext(logContext, { 
        fileValidation: 'passed',
        inputFile: imageMetadata.originalPath
      })
      logger.info('Low-Quality Resize Step – Input file validation passed', validationContext)
      
    } catch (validationError) {
      const safeError = createSafeErrorMessage(validationError, 'Input file validation failed')
      const errorContext = buildLogContext(logContext, { 
        validationError: safeError.message,
        errorType: 'input_validation'
      })
      
      logger.error('Low-Quality Resize Step – Input file validation failed', errorContext)
      throw new Error(`Input validation failed: ${safeError.message}`)
    }

    // Get resize configuration for low-quality with error handling
    let resizeConfig: { width: number; quality?: number }
    let lowqualityPath: string
    
    try {
      resizeConfig = getResizeConfig('lowquality')
      lowqualityPath = getResizedImagePath(imageMetadata.uniqueFilename, 'lowquality')

      const configContext = buildLogContext(logContext, { 
        targetWidth: resizeConfig.width,
        quality: resizeConfig.quality,
        outputPath: lowqualityPath,
        configLoaded: 'success'
      })
      logger.info('Low-Quality Resize Step – Configuration loaded', configContext)
      
    } catch (configError) {
      const safeError = createSafeErrorMessage(configError, 'Configuration loading failed')
      const errorContext = buildLogContext(logContext, { 
        configError: safeError.message,
        errorType: 'config_loading'
      })
      
      logger.error('Low-Quality Resize Step – Failed to load configuration', errorContext)
      throw new Error(`Configuration failed: ${safeError.message}`)
    }

    // Ensure output directory exists with enhanced error handling
    try {
      ensureDirectoryExists(dirname(lowqualityPath))
      
      const dirContext = buildLogContext(logContext, { 
        outputDirectory: dirname(lowqualityPath),
        directoryCreation: 'success'
      })
      logger.info('Low-Quality Resize Step – Output directory verified/created', dirContext)
      
    } catch (dirError) {
      const safeError = createSafeErrorMessage(dirError, 'Directory creation failed')
      const errorContext = buildLogContext(logContext, { 
        directoryError: safeError.message,
        errorType: 'directory_creation',
        targetDirectory: dirname(lowqualityPath)
      })
      
      logger.error('Low-Quality Resize Step – Failed to create output directory', errorContext)
      throw new Error(`Directory preparation failed: ${safeError.message}`)
    }

    // Perform image resize using Sharp with compression and enhanced error handling
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
        targetWidth: resizeConfig.width,
        targetQuality: resizeConfig.quality
      })
      logger.info('Low-Quality Resize Step – Input image metadata retrieved', metadataContext)
      
      // Validate image dimensions
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image: missing width or height information')
      }
      
      if (metadata.width < 1 || metadata.height < 1) {
        throw new Error(`Invalid image dimensions: ${metadata.width}x${metadata.height}`)
      }

      // Create resize instance
      const resizeInstance = sharpInstance
        .resize({
          width: resizeConfig.width,
          height: undefined, // Maintain aspect ratio
          fit: 'inside',
          withoutEnlargement: true // Don't upscale smaller images
        })

      // Apply quality compression based on format with enhanced error handling
      try {
        if (imageMetadata.format === 'jpeg') {
          resizeInstance.jpeg({ quality: resizeConfig.quality })
          logger.info('Low-Quality Resize Step – Applied JPEG compression', buildLogContext(logContext, { 
            compressionType: 'jpeg',
            quality: resizeConfig.quality
          }))
        } else if (imageMetadata.format === 'webp') {
          resizeInstance.webp({ quality: resizeConfig.quality })
          logger.info('Low-Quality Resize Step – Applied WebP compression', buildLogContext(logContext, { 
            compressionType: 'webp',
            quality: resizeConfig.quality
          }))
        } else if (imageMetadata.format === 'png') {
          // PNG doesn't support quality in the same way, use compression level instead
          resizeInstance.png({ compressionLevel: 9, quality: resizeConfig.quality })
          logger.info('Low-Quality Resize Step – Applied PNG compression', buildLogContext(logContext, { 
            compressionType: 'png',
            compressionLevel: 9,
            quality: resizeConfig.quality
          }))
        }
      } catch (compressionError) {
        const safeError = createSafeErrorMessage(compressionError, 'Compression configuration failed')
        logger.warn('Low-Quality Resize Step – Compression configuration failed, proceeding without compression', buildLogContext(logContext, { 
          compressionError: safeError.message,
          format: imageMetadata.format
        }))
      }

      // Perform the resize operation
      await resizeInstance.toFile(lowqualityPath)

      const processingTime = Date.now() - sharpStartTime

      const successContext = buildLogContext(logContext, { 
        originalPath: imageMetadata.originalPath,
        lowqualityPath,
        targetWidth: resizeConfig.width,
        quality: resizeConfig.quality,
        processingTimeMs: processingTime,
        inputDimensions: `${metadata.width}x${metadata.height}`,
        sharpProcessing: 'success'
      })
      logger.info('Low-Quality Resize Step – Successfully resized image for low-quality', successContext)

    } catch (sharpError) {
      const safeError = createSafeErrorMessage(sharpError, 'Sharp processing failed')
      const errorContext = buildLogContext(logContext, { 
        sharpError: safeError.message,
        errorType: 'sharp_processing',
        inputPath: imageMetadata.originalPath,
        outputPath: lowqualityPath,
        targetWidth: resizeConfig.width,
        targetQuality: resizeConfig.quality
      })
      
      logger.error('Low-Quality Resize Step – Sharp processing failed', errorContext)
      
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
      resizeType: 'lowquality' as const,
      outputPath: lowqualityPath,
      targetWidth: resizeConfig.width,
      quality: resizeConfig.quality,
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
    logger.info('Low-Quality Resize Step – Completion event data prepared', completionContext)

    // Emit lowquality-resize-complete event with enhanced error handling
    try {
      await emit({
        topic: 'lowquality-resize-complete',
        data: {
          ...completionData,
          uploadedAt: typeof completionData.uploadedAt === 'string' ? completionData.uploadedAt : completionData.uploadedAt.toISOString(),
          completedAt: completionData.completedAt.toISOString()
        },
      })
      
      const emitContext = buildLogContext(logContext, { 
        eventTopic: 'lowquality-resize-complete',
        eventEmission: 'success',
        resizeType: 'lowquality'
      })
      logger.info('Low-Quality Resize Step – Successfully emitted lowquality-resize-complete event', emitContext)
      
    } catch (emitError) {
      const safeError = createSafeErrorMessage(emitError, 'Event emission failed')
      const errorContext = buildLogContext(logContext, { 
        emitError: safeError.message,
        errorType: 'event_emission',
        eventTopic: 'lowquality-resize-complete'
      })
      
      logger.error('Low-Quality Resize Step – Failed to emit lowquality-resize-complete event', errorContext)
      throw new Error(`Failed to emit completion event: ${safeError.message}`)
    }

    // Calculate total processing time and log final success
    const totalProcessingTime = Date.now() - startTime
    const finalContext = buildLogContext(logContext, { 
      originalFilename: imageMetadata.originalFilename,
      lowqualityPath,
      totalProcessingTimeMs: totalProcessingTime,
      operationSuccess: true,
      resizeType: 'lowquality'
    })
    
    logger.info('Low-Quality Resize Step – Low-quality resize operation completed successfully', finalContext)

  } catch (error) {
    const totalProcessingTime = Date.now() - startTime
    const safeError = createSafeErrorMessage(error, 'Low-quality resize operation failed')
    const errorContext = buildLogContext({ 
      step: 'LowQualityResize',
      traceId,
      totalProcessingTimeMs: totalProcessingTime,
      operationError: safeError.message,
      errorType: 'operation_failure',
      imageMetadata: input
    })
    
    logger.error('Low-Quality Resize Step – Unexpected error during low-quality resize', errorContext)

    // Re-throw the error to mark the step as failed in Motia Workbench
    // Ensure the error message is informative for debugging
    if (error instanceof Error) {
      throw error
    } else {
      throw new Error(`Low-quality resize failed: ${safeError.message}`)
    }
  }
}