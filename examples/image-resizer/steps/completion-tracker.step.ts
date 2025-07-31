import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import type { ProcessingStatus } from '../shared/interfaces'
import { 
  createSafeErrorMessage,
  buildLogContext
} from '../shared/utils'

export const config: EventConfig = {
  type: 'event',
  name: 'CompletionTracker',
  description: 'Track completion of all resize operations and emit final processing-complete event',

  /**
   * Subscribe to all three resize completion events
   */
  subscribes: ['desktop-resize-complete', 'mobile-resize-complete', 'lowquality-resize-complete'],

  /**
   * This is the final step - no events need to be emitted
   */
  emits: [],

  /** 
   * Expected event data schema - completion data from resize steps
   */
  input: z.object({
    originalFilename: z.string(),
    uniqueFilename: z.string(),
    format: z.enum(['jpeg', 'png', 'webp']),
    originalPath: z.string(),
    traceId: z.string(),
    uploadedAt: z.string().or(z.date()),
    resizeType: z.enum(['desktop', 'mobile', 'lowquality']),
    outputPath: z.string(),
    targetWidth: z.number(),
    quality: z.number().optional(),
    completedAt: z.string().or(z.date())
  }),

  /**
   * The flows this step belongs to, will be available in Workbench
   */
  flows: ['image-processing'],
}

export const handler: Handlers['CompletionTracker'] = async (input, { logger, emit, traceId, state }) => {
  const startTime = Date.now()
  
  try {
    const completionData = input as any
    const { resizeType, originalFilename, uniqueFilename } = completionData

    const logContext = buildLogContext({ 
      step: 'CompletionTracker',
      resizeType,
      originalFilename,
      uniqueFilename,
      traceId 
    })

    logger.info('Completion Tracker Step – Received resize completion event', logContext)

    // Validate input data
    if (!resizeType || !['desktop', 'mobile', 'lowquality'].includes(resizeType)) {
      const errorContext = buildLogContext(logContext, { 
        validationError: 'Invalid resize type',
        receivedType: resizeType,
        expectedTypes: ['desktop', 'mobile', 'lowquality']
      })
      logger.error('Completion Tracker Step – Invalid resize type received', errorContext)
      throw new Error(`Invalid resize type: ${resizeType}`)
    }

    if (!uniqueFilename || typeof uniqueFilename !== 'string') {
      const errorContext = buildLogContext(logContext, { 
        validationError: 'Invalid unique filename',
        receivedFilename: uniqueFilename
      })
      logger.error('Completion Tracker Step – Invalid unique filename received', errorContext)
      throw new Error('Invalid unique filename in completion data')
    }

    // Get or initialize processing status from state with enhanced error handling
    const stateKey = 'processing-status'
    let processingStatus: ProcessingStatus
    
    try {
      processingStatus = await state.get<ProcessingStatus>(traceId, stateKey) || {
        traceId,
        originalImage: uniqueFilename,
        desktopComplete: false,
        mobileComplete: false,
        lowqualityComplete: false
      }

      const stateContext = buildLogContext(logContext, { 
        processingStatus,
        stateRetrieval: 'success'
      })
      logger.info('Completion Tracker Step – Retrieved processing status from state', stateContext)
      
    } catch (stateError) {
      const safeError = createSafeErrorMessage(stateError, 'State retrieval failed')
      const errorContext = buildLogContext(logContext, { 
        stateError: safeError.message,
        errorType: 'state_retrieval'
      })
      
      logger.error('Completion Tracker Step – Failed to retrieve state, initializing new status', errorContext)
      
      // Initialize new status if state retrieval fails
      processingStatus = {
        traceId,
        originalImage: uniqueFilename,
        desktopComplete: false,
        mobileComplete: false,
        lowqualityComplete: false
      }
    }

    // Update completion status based on resize type with enhanced logging
    const previousStatus = { ...processingStatus }
    
    switch (resizeType) {
      case 'desktop':
        processingStatus.desktopComplete = true
        const desktopContext = buildLogContext(logContext, { 
          resizeType: 'desktop',
          outputPath: completionData.outputPath,
          statusUpdate: 'desktop_complete'
        })
        logger.info('Completion Tracker Step – Desktop resize marked as complete', desktopContext)
        break
      case 'mobile':
        processingStatus.mobileComplete = true
        const mobileContext = buildLogContext(logContext, { 
          resizeType: 'mobile',
          outputPath: completionData.outputPath,
          statusUpdate: 'mobile_complete'
        })
        logger.info('Completion Tracker Step – Mobile resize marked as complete', mobileContext)
        break
      case 'lowquality':
        processingStatus.lowqualityComplete = true
        const lowqualityContext = buildLogContext(logContext, { 
          resizeType: 'lowquality',
          outputPath: completionData.outputPath,
          statusUpdate: 'lowquality_complete'
        })
        logger.info('Completion Tracker Step – Low-quality resize marked as complete', lowqualityContext)
        break
      default:
        const unknownContext = buildLogContext(logContext, { 
          unknownResizeType: resizeType,
          errorType: 'unknown_resize_type'
        })
        logger.warn('Completion Tracker Step – Unknown resize type received', unknownContext)
        return
    }

    // Log status change
    const statusChangeContext = buildLogContext(logContext, { 
      previousStatus,
      updatedStatus: processingStatus,
      statusChange: 'updated'
    })
    logger.info('Completion Tracker Step – Processing status updated', statusChangeContext)

    // Save updated status to state with enhanced error handling
    try {
      await state.set(traceId, stateKey, processingStatus)
      
      const stateUpdateContext = buildLogContext(logContext, { 
        processingStatus,
        stateUpdate: 'success'
      })
      logger.info('Completion Tracker Step – Updated processing status in state', stateUpdateContext)
      
    } catch (stateError) {
      const safeError = createSafeErrorMessage(stateError, 'State update failed')
      const errorContext = buildLogContext(logContext, { 
        stateError: safeError.message,
        errorType: 'state_update',
        processingStatus
      })
      
      logger.error('Completion Tracker Step – Failed to update state', errorContext)
      throw new Error(`Failed to update processing status: ${safeError.message}`)
    }

    // Check if all resize operations are complete with enhanced logging
    const allComplete = processingStatus.desktopComplete && 
                       processingStatus.mobileComplete && 
                       processingStatus.lowqualityComplete

    const completionCheckContext = buildLogContext(logContext, { 
      desktopComplete: processingStatus.desktopComplete,
      mobileComplete: processingStatus.mobileComplete,
      lowqualityComplete: processingStatus.lowqualityComplete,
      allComplete
    })
    logger.info('Completion Tracker Step – Checked completion status', completionCheckContext)

    if (allComplete) {
      // Mark completion time
      processingStatus.completedAt = new Date()
      
      const allCompleteContext = buildLogContext(logContext, { 
        processingStatus: {
          ...processingStatus,
          completedAt: processingStatus.completedAt.toISOString()
        },
        workflowComplete: true
      })
      logger.info('Completion Tracker Step – All resize operations completed!', allCompleteContext)

      // Update final status in state with enhanced error handling
      try {
        await state.set(traceId, stateKey, processingStatus)
        
        const finalStateContext = buildLogContext(logContext, { 
          processingStatus: {
            ...processingStatus,
            completedAt: processingStatus.completedAt.toISOString()
          },
          finalStateUpdate: 'success'
        })
        logger.info('Completion Tracker Step – Final processing status saved to state', finalStateContext)
        
      } catch (stateError) {
        const safeError = createSafeErrorMessage(stateError, 'Final state save failed')
        const errorContext = buildLogContext(logContext, { 
          stateError: safeError.message,
          errorType: 'final_state_save',
          processingStatus
        })
        
        logger.error('Completion Tracker Step – Failed to save final state', errorContext)
        // Continue with emission even if state save fails
      }

      // Log final completion - no event emission needed as this is the final step
      const finalCompletionContext = buildLogContext(logContext, { 
        processingStatus: {
          ...processingStatus,
          completedAt: processingStatus.completedAt.toISOString()
        },
        allResizesComplete: true,
        workflowCompletedAt: processingStatus.completedAt.toISOString(),
        finalStep: true
      })
      logger.info('Completion Tracker Step – All resize operations completed - workflow finished', finalCompletionContext)

      // Calculate total processing time and log final success
      const totalProcessingTime = Date.now() - startTime
      const finalSuccessContext = buildLogContext(logContext, { 
        originalFilename,
        uniqueFilename,
        totalStepsCompleted: 3,
        completedAt: processingStatus.completedAt.toISOString(),
        totalProcessingTimeMs: totalProcessingTime,
        workflowSuccess: true
      })
      
      logger.info('Completion Tracker Step – Image processing workflow completed successfully', finalSuccessContext)

    } else {
      // Log current progress with enhanced context
      const completedSteps = [
        processingStatus.desktopComplete && 'desktop',
        processingStatus.mobileComplete && 'mobile', 
        processingStatus.lowqualityComplete && 'lowquality'
      ].filter(Boolean)

      const pendingSteps = [
        !processingStatus.desktopComplete && 'desktop',
        !processingStatus.mobileComplete && 'mobile',
        !processingStatus.lowqualityComplete && 'lowquality'
      ].filter(Boolean)

      const progressContext = buildLogContext(logContext, { 
        completedSteps,
        pendingSteps,
        completedCount: completedSteps.length,
        totalSteps: 3,
        progressPercentage: Math.round((completedSteps.length / 3) * 100),
        workflowInProgress: true
      })
      
      logger.info('Completion Tracker Step – Workflow in progress', progressContext)
    }

  } catch (error) {
    const totalProcessingTime = Date.now() - startTime
    const safeError = createSafeErrorMessage(error, 'Completion tracking failed')
    const errorContext = buildLogContext({ 
      step: 'CompletionTracker',
      traceId,
      totalProcessingTimeMs: totalProcessingTime,
      trackingError: safeError.message,
      errorType: 'tracking_failure',
      input
    })
    
    logger.error('Completion Tracker Step – Unexpected error during completion tracking', errorContext)

    // Re-throw the error to mark the step as failed in Motia Workbench
    // Ensure the error message is informative for debugging
    if (error instanceof Error) {
      throw error
    } else {
      throw new Error(`Completion tracking failed: ${safeError.message}`)
    }
  }
}