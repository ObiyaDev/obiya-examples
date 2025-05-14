# Motia Farcaster Trend Summarizer 🌐🔥

A real-time **Farcaster trend analysis agent** built with the Motia event-driven framework. This agent monitors casts on Farcaster via Neynar's API, detects trending topics based on content frequency and engagement, and sends periodic **OpenAI-generated summaries** to Slack.

## Features

- Real-time Farcaster feed monitoring (via polling or webhook)
- Configurable keyword and creator filtering
- 5-minute sliding window for trend detection
- Sentiment and engagement-based trend scoring
- OpenAI-powered summarization of trending content
- Clean, readable Slack notifications with insights

## Prerequisites

- Node.js 16+
- Neynar API key (for Farcaster data access)
- OpenAI API key (GPT-4 or GPT-3.5)
- Slack webhook URL

## Environment Variables

Create a `.env` file with the following:

```env
# Neynar API Key
NEYNAR_API_KEY=your_neynar_key

# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key

# Slack Webhook URL
SLACK_WEBHOOK_URL=your_slack_webhook_url

# Trend detection config
TREND_THRESHOLD=40
PAUSE_BEFORE_ALERT=false
```

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-handle/motia-farcaster-trends.git
   cd motia-farcaster-trends
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

## Usage

1. Configure your `.env` file.
2. Start the development server:
   ```bash
   pnpm dev
   ```
3. Trigger polling manually:
   ```bash
   curl -X POST http://localhost:8787/fetch-trends
   ```
4. You’ll receive a Slack message with trending topics every time a trend is detected and summarized.

## Architecture

The flow includes:

1. **Farcaster Poller Step** (`api` or `cron`): Fetches recent casts from Neynar
2. **Trend Detection Step** (`event`): Filters, scores, and groups trending content
3. **OpenAI Summary Step**: Condenses trends into human-readable insights
4. **Slack Alert Step**: Posts the summary to Slack with optional approval gate (`noop`)

## Contributing

Contributions are welcome! Please fork the repo and open a PR.

## License

MIT
