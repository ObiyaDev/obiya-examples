// steps/workflow-connector.step.js

exports.config = {
    type: 'noop',
    name: 'workflow-connector',
    virtualSubscribes: ['file-content-fetched'],
    virtualEmits: ['documentation-analysis-started'],
    flows: ['documentation-guardian']
  };
  
  exports.handler = async (payload, context) => {
    const { emit, logger } = context;
    
    // Basic connection log
    logger.info('📊 Documentation Guardian workflow: File content fetch completed, beginning analysis phase');
    
    // Log detailed information about the payload
    logger.debug('🔍 File details:', {
      fileName: payload.file,
      repository: payload.repository,
      contentSize: payload.content ? payload.content.length : 0,
      commitSha: payload.commitSha
    });
    
    // Performance tracking
    const startTime = Date.now();
    
    // Workflow metadata for tracing
    const workflowMetadata = {
      step: "workflow-connector",
      timestamp: new Date().toISOString(),
      workflowPhase: "pre-analysis"
    };
    
    // Emit the event with the enhanced payload
    emit({
      topic: "documentation-analysis-started",
      data: {
        ...payload,
        _metadata: {
          ...workflowMetadata,
          processingTime: Date.now() - startTime
        }
      }
    });
    
    // Log completion
    logger.info('🔄 Analysis phase initiated, payload forwarded with workflow metadata');
    
    return;
  };