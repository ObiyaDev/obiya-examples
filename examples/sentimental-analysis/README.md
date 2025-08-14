# Sentiment Analysis API

A powerful example demonstrating **AI-powered sentiment analysis** and **event-driven architecture** using the Motia framework with OpenAI integration.

![Motia Workbench](docs/images/sentimental-analyzer-workbench.gif)

## 🚀 Features

- **AI-Powered Analysis**: Real-time sentiment analysis using OpenAI's GPT models
- **Event-driven Architecture**: Clean API → AI Analysis → Response Handlers flow
- **Dual Response Handling**: Separate handlers for positive and negative sentiment results
- **Type-safe Events**: End-to-end type safety with Zod schemas
- **Minimal Complexity**: Complete sentiment analysis system in just 4 core files

## 📁 Architecture

```
sentimental-analysis/
├── steps/
│   ├── analyzeSentimentApi.step.ts     # API endpoint for sentiment analysis
│   ├── openAiAnalyzeSentiment.step.ts  # OpenAI integration and analysis logic
│   ├── handlePositive.step.ts          # Handles positive sentiment responses
│   ├── handleNegative.step.ts          # Handles negative sentiment responses
│   └── 00-noop.step.tsx               # Default noop step
├── package.json                        # Dependencies including OpenAI
├── tsconfig.json                       # TypeScript configuration
├── motia-workbench.json               # Motia workbench configuration
└── README.md                          # This file
```

## 🛠️ Setup

### Installation & Setup

```bash
# Clone or navigate to your project directory
cd sentimental-analysis

# Install dependencies
npm install

# Generate types
npm run generate-types

# Start the development server
npm run dev
```

### Configure OpenAI API

Create a `.env` file and add your OpenAI API key:
```bash
# Create .env file
touch .env

# Add your OpenAI API key
echo "OPENAI_API_KEY=your-openai-api-key-here" >> .env
```

**Open Motia Workbench**:
Navigate to `http://localhost:3000` to interact with the sentiment analysis API

## 🔧 Usage

### Analyze Sentiment

**POST** `/api/analyze-sentiment`

```json
{
  "text": "I absolutely love this product! It's amazing!"
}
```

**Response:**
```json
{
  "status": "Accepted",
  "message": "Your text is being analyzed"
}
```

The system will:
1. Accept your text for analysis
2. Send it to OpenAI for sentiment evaluation
3. Route the response to appropriate handlers based on sentiment
4. Log the results for positive or negative sentiment

### Example Requests

**Positive Sentiment:**
```bash
curl -X POST http://localhost:3000/api/analyze-sentiment \
  -H "Content-Type: application/json" \
  -d '{"text": "This is fantastic! I love it!"}'
```

**Negative Sentiment:**
```bash
curl -X POST http://localhost:3000/api/analyze-sentiment \
  -H "Content-Type: application/json" \
  -d '{"text": "This is terrible and disappointing."}'
```

## 🎯 Key Concepts Demonstrated

### 1. **API Event Emission**
```typescript
export const handler: Handlers['analyzeSentimentApi'] = async (req, { emit, logger }) => {
  const { text } = req.body

  // Emit an event to trigger OpenAI analysis
  await emit({
    topic: 'openai.analyzeSentimentRequest',
    data: { text },
  })

  return {
    status: 200,
    body: { status: 'Accepted', message: 'Your text is being analyzed' },
  }
}
```

### 2. **OpenAI Integration with Event Routing**
```typescript
// OpenAI client instantiation
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// AI analysis and event routing based on sentiment
if (parsed.sentiment.toLowerCase() === 'positive') {
  await emit({
    topic: 'openai.positiveSentiment',
    data: { ...parsed, sentiment: parsed.sentiment },
  })
} else {
  await emit({
    topic: 'openai.negativeSentiment',
    data: { ...parsed, sentiment: parsed.sentiment },
  })
}
```

### 3. **Type-safe Event Handling**
```typescript
export const config = {
  type: 'event',
  name: 'handlePositive',
  subscribes: ['openai.positiveSentiment'],
  input: z.object({
    sentiment: z.string(),
    analysis: z.string().optional(),
  }),
} as const
```

### 4. **Multiple Event Subscribers**
```typescript
// Positive sentiment handler
export const config = {
  subscribes: ['openai.positiveSentiment'],
  // Handle positive feedback
}

// Negative sentiment handler  
export const config = {
  subscribes: ['openai.negativeSentiment'],
  // Handle negative feedback - alerts, escalations, etc.
}
```

## 🌟 Why This Example Matters

This example showcases Motia's power in building **intelligent event-driven APIs**:

- **AI Integration**: Seamless OpenAI integration with proper error handling
- **Event-driven Flow**: Clean separation between API, AI processing, and response handling
- **Type Safety**: End-to-end type safety from API request to event handlers
- **Scalable Architecture**: Easy to extend with additional sentiment categories or processing logic
- **Minimal Code**: Complete sentiment analysis system in under 100 lines of code

Perfect for demonstrating how Motia makes complex AI-powered workflows simple and maintainable.

## 🔑 Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required for AI analysis)

## 📝 Notes

- The system uses OpenAI's `gpt-3.5-turbo` model for cost-effective sentiment analysis
- Responses are parsed as JSON with `sentiment` and `analysis` fields
- The flow demonstrates event-driven architecture with multiple subscribers
- Error handling is built-in for both API failures and JSON parsing issues
- Logs provide detailed information about the analysis process

## 🔄 Flow Diagram

```
POST /api/analyze-sentiment
        ↓
   [API Handler] → emit('openai.analyzeSentimentRequest')
        ↓
[OpenAI Analysis] → parse sentiment → emit positive/negative event
        ↓                              ↓
[Positive Handler]              [Negative Handler]
   (log success)                (log/alert/escalate)
```

## 🛡️ Error Handling

The system includes comprehensive error handling:

- **Invalid API requests**: Zod validation ensures proper request format
- **OpenAI API failures**: Graceful error handling with detailed logging  
- **JSON parsing errors**: Fallback handling for malformed AI responses
- **Missing environment variables**: Clear error messages for setup issues

## 📈 Extending the System

Easy extension points:

1. **Additional Sentiment Categories**: Add neutral, mixed, or emotion-specific handlers
2. **Multiple AI Providers**: Add handlers for different AI services
3. **Data Storage**: Add database integration for sentiment history
4. **Webhooks**: Integrate with external services for notifications
5. **Analytics**: Add metrics collection for sentiment trends
