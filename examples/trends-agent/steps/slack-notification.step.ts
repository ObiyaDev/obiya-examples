import { EventConfig, StepHandler } from '@motiadev/core';
import { z } from 'zod';
import axios from 'axios';
import { TrendAnalysisResult } from './types';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
if (!SLACK_WEBHOOK_URL) {
  throw new Error('Slack Webhook URL is not set in environment variables');
}

export const config: EventConfig = {
  type: 'event',
  name: 'Slack Notifications',
  subscribes: ['trend.analyzed'],
  emits: ['trend.sent'],
  input: z.object({
    slackWebhookUrl: z.string(),
  }),
  flows: ['farcaster'],
};

/**
 * Send trend analysis results to Slack
 */
const sendToSlack = async (webhookUrl: string, result: TrendAnalysisResult) => {
  console.log("SENDING TO SLACK");
  console.log(result);
  try {
    const message = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🔥 Trending Topics Analysis",
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: result.summary
          }
        },
        {
          type: "divider"
        }
      ]
    };

    message.blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `_Last updated: ${new Date(result.timestamp).toLocaleString()}_`
      }
    });
    const slackUrl = SLACK_WEBHOOK_URL;

    await axios.post(slackUrl, message);
    console.log('Successfully sent trend analysis to Slack');
  } catch (error) {
    console.error('Failed to send trend analysis to Slack:', error);
  }
};

export const handler: StepHandler<typeof config> = async (input, context) => {
  console.log('=== Processing Slack Notification ===');
  const { slackWebhookUrl } = input;
  const trendData = input as TrendAnalysisResult;

  console.log('Sending trend analysis to Slack...');
  await sendToSlack(slackWebhookUrl, trendData);
}; 