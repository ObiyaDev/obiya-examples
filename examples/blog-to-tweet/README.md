# 🚀 Blog to Viral tweets

<p align="center">
  <strong>🔥 A Modern Unified Backend Framework for APIs, Events and Agents 🔥</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/motia">
    <img src="https://img.shields.io/npm/v/motia?style=flat&logo=npm&logoColor=white&color=CB3837&labelColor=000000" alt="npm version">
  </a>
  <a href="https://github.com/MotiaDev/motia">
    <img src="https://img.shields.io/github/stars/MotiaDev/motia?style=flat&logo=github&logoColor=white&color=yellow&labelColor=000000" alt="GitHub stars">
  </a>
  <a href="https://twitter.com/motiadev" target="_blank">
    <img src="https://img.shields.io/badge/Follow-@motiadev-1DA1F2?style=flat&logo=twitter&logoColor=white&labelColor=000000" alt="Twitter Follow">
  </a>
  <a href="https://discord.gg/EnfDRFYW" target="_blank">
    <img src="https://img.shields.io/discord/1322278831184281721?style=flat&logo=discord&logoColor=white&color=5865F2&label=Discord&labelColor=000000" alt="Discord">
  </a>
</p>

> Transform your blog posts into viral tweets using AI

**An intelligent  pipeline that monitors your Dev.to articles and automatically generates viral tweets using AI, with `tracing`, and `deployment` on Motia Cloud**

## 🎯 What It Does

This Motia application demonstrates the power of AI-native backend development by creating a seamless content amplification workflow:

1. **📡 Fetches** your latest Dev.to publication
2. **🧠 Analyzes** content using GPT-4 for virality  
3. **✨ Generates** multiple tweet variations optimized for engagement
4. **📊 Provides** APIs to retrieve and manage generated content

## 🏗️ Architecture Overview
![Architecture Overview](https://private-user-images.githubusercontent.com/62152915/459364601-e7b61689-4532-40b4-8c31-f1064477561a.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NTA5MzM5MjUsIm5iZiI6MTc1MDkzMzYyNSwicGF0aCI6Ii82MjE1MjkxNS80NTkzNjQ2MDEtZTdiNjE2ODktNDUzMi00MGI0LThjMzEtZjEwNjQ0Nzc1NjFhLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTA2MjYlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUwNjI2VDEwMjcwNVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTQzNGQ0YjhlYWU3NGNhYjdiZjc1NDEzYmY1NDFhZTFmODA1NTI3YjMzNjE1YTkwNmNjNTYzY2Q2ZmQwNWI4ZmUmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.YsQAWqG6Y2MYwNStgemgkyDRqIE_gAz97lOjB4Xn3D8)

Built with **4 composable Motia Steps**:
- 🌐 **API Step**: Article detection endpoint
- ⚡ **Event Step**: AI processing trigger  
- 🤖 **AI Service**: OpenAI integration
- 📤 **Retrieval API**: Content access endpoint

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Motia CLI (`npm install -g motia-cli`)
- OpenAI API key
- Dev.to API key

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/content-amplification-pipeline
cd content-amplification-pipeline

# Install dependencies
npm install
```

### Environment Variables

Create a `.env` file with the following variables:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Dev.to Integration
DEVTO_API_KEY=your-devto-api-key-here

# Application Settings
TRACE_ID=default-trace-id
NODE_ENV=development
```

### Development

```bash
# Start development server
motia dev

# Your application will be running at http://localhost:3000
```

### Production Deployment

```bash
# Deploy to production
motia cloud deploy --environment production --version-name 1.2.3 --api-key your-api-key-here
```

## 📡 API Endpoints

### 1. Check for New Articles

**Endpoint:** `GET /get-last-published-article`

Monitors your Dev.to account for new publications and triggers AI processing when found.

**Response:**
```json
{
  "message": "API step ran successfully",
  "traceId": "abc123-def456-ghi789"
}
```

**Behavior:**
- Fetches your latest published article from Dev.to
- Compares with previously processed article ID
- If new article found: triggers AI processing pipeline
- If no new article: returns early without processing

**Example:**
```bash
curl -X GET http://localhost:3000/get-last-published-article
```

### 2. Retrieve Generated Tweets

**Endpoint:** `GET /retrieve-tweets/:traceId`

Fetches AI-generated tweets for a specific processing trace.

**Parameters:**
- `traceId` (path): Unique identifier for the processing pipeline

**Response:**
```json
{
  "message": [
    {
      "type": "classic",
      "tweet": "🚀 Just discovered why 73% of developers are switching to event-driven architectures. The reason will surprise you... 🧵",
      "reason": "Uses curiosity gap and statistics to create engagement, perfect for tech Twitter"
    },
    {
      "type": "listicle", 
      "tweet": "3 signs your backend is ready for the AI revolution:\n\n✅ Event-driven design\n✅ Composable architecture  \n✅ Built-in observability\n\nMost teams have 0/3 👀",
      "reason": "List format with checkmarks is highly shareable, creates FOMO"
    },
    {
      "type": "quote",
      "tweet": "\"The best backend frameworks don't just handle complexity—they make it disappear.\"",
      "reason": "Quotable insight that developers will want to retweet and save"
    }
  ]
}
```

**Example:**
```bash
curl -X GET http://localhost:3000/retrieve-tweets/abc123-def456-ghi789
```

## 🧠 AI Processing Pipeline

### Content Analysis

The AI processing step uses a sophisticated prompt that:

- **Extracts** key themes and technical concepts
- **Identifies** viral hooks and engagement patterns
- **Generates** multiple tweet formats:
  - **Classic**: Hook + Insight + Callback
  - **Listicle**: Numbered or emoji-based lists
  - **Quote**: Standalone punchy insights

### Tweet Generation Strategy

```javascript
// Example of AI prompt engineering for viral content
const prompt = `
You are a viral content strategist for developer communities on X.

Transform this technical article into 3-5 viral tweets that:
1. Use proven engagement patterns (curiosity gaps, lists, quotes)
2. Include specific technical details that establish credibility  
3. Appeal to developers, engineers, and tech influencers
4. Stay within 280 characters while maximizing shareability

Output format: JSON array with type, tweet, and viral reasoning...
`;
```

## 📊 Observability & Monitoring

### Built-in Tracing

Every user has their tweets bound with  a unique `traceId` that follows data through the entire pipeline.

### State Management

Application state is automatically managed across Steps:

```javascript
// Persistent state across the pipeline
await state.set(traceId, 'lastPublishedArticle', articleId);
await state.set(traceId, 'tweets', generatedTweets);

// Retrieve state in any Step
const tweets = await state.get(traceId, 'tweets');
```

## 🔧 Configuration

### Step Configuration Examples

#### API Step Configuration
```javascript
exports.config = {
  type: 'api',
  name: 'fetch devto articles',
  emits: ['article.submitted'],
  flows: ['content-pipeline'],
  path: '/get-last-published-article',
  method: 'GET',
  responseSchema: {
    200: z.object({
      message: z.string(),
    }),
  },
}
```

#### Event Step Configuration  
```javascript
const config = {
  type: 'event',
  name: 'processArticle', 
  subscribes: ['article.submitted'],
  emits: ['processedArticle'],
  input: z.object({body: z.string()}),
  flows: ['content-pipeline'],
};
```


## 🔒 Security Considerations

### API Key Management
- Store API keys in environment variables only
- Use different keys for development/production
- Rotate keys regularly using your provider's dashboard

### State Security
- State data encrypted at rest
- Trace IDs are unique for isolation


## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow the existing code style
- Add tests for new functionality
- Update documentation for API changes
- Ensure all Steps have proper configuration

## 📚 Learn More

### Motia Framework
- [📖 Documentation](https://motia.dev/docs)
- [🎯 Examples Repository](https://github.com/MotiaDev/motia-examples)
- [💬 Community Discord](https://discord.gg/feRUQnbM)


## 🙏 Acknowledgments

- **Motia Team** - For building the framework that makes this possible
- **OpenAI** - For providing the AI capabilities that power content generation
- **Dev.to** - For the excellent API that makes content monitoring seamless

---

**⭐ If this project helped you, please consider starring the repository!**

Built with ❤️ using [Motia](https://motia.dev)