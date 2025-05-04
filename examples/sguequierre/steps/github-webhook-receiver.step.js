// steps/github-webhook-receiver.step.js
const crypto = require('crypto');
const { subscribe } = require('diagnostics_channel');

exports.config = {
  type: 'api',
  name: 'github-webhook-receiver',
  path: '/webhook/github',
  method: 'POST',
  emits: ['repository-webhook'],
  flows: ['documentation-guardian']
};

// Function to verify GitHub signature
function verifyGitHubSignature(payload, signature, secret) {
  // If no signature or secret, it's a test request
  if (!signature || !secret) {
    return true; // Accept test requests without signature
  }
  
  try {
    const hmac = crypto.createHmac('sha256', secret);
    const computedSignature = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(computedSignature),
      Buffer.from(signature)
    );
  } catch (error) {
    return false;
  }
}

exports.handler = async (req, context) => {
  const { emit, logger } = context;
  
  // Get the signature from the headers
  const signature = req.headers['x-hub-signature-256'];
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  
  logger.info("Received GitHub webhook request");
  
  // For debugging
  logger.info("Headers received:", Object.keys(req.headers));
  logger.info("Body received:", JSON.stringify(req.body).substring(0, 200) + "...");
  
  // Bypass verification for testing or verify signature
  if (req.headers['user-agent'] && req.headers['user-agent'].includes('curl')) {
    // This is a test request from curl, accept it
    logger.info("Test request detected, bypassing signature verification");
  } else if (!verifyGitHubSignature(req.body, signature, webhookSecret)) {
    logger.warn("Invalid webhook signature - rejecting request");
    return {
      status: 401,
      body: { error: "Invalid signature" }
    };
  }
  
  logger.info("Webhook accepted");
  
  // Emit event with the webhook payload
  emit({
    topic: "repository-webhook",
    data: req.body
  });
  
  return {
    status: 200,
    body: { status: "received" }
  };
};