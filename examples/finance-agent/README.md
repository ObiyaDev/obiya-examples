# Finance Agent Workflow

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Motia](https://img.shields.io/badge/Motia-Latest-green.svg)](https://motia.dev)

A powerful event-driven financial analysis workflow built with Motia that combines web search, financial data, and AI analysis to provide comprehensive investment insights.

## 🚀 Features

- **Real-time Financial Analysis**: Combines multiple data sources for comprehensive insights
- **AI-Powered Insights**: Leverages OpenAI GPT-4 for intelligent market analysis
- **Event-Driven Architecture**: Built on Motia's robust event system for reliable processing
- **Web Search Integration**: Aggregates latest market news and analysis
- **Financial Data Integration**: Real-time stock and company information
- **Persistent Storage**: Stores analysis results for future reference
- **RESTful API**: Easy integration with existing systems

## 📋 Prerequisites

- Node.js v16+
- npm or pnpm
- API keys for:
  - [Alpha Vantage](https://www.alphavantage.co/) (financial data)
  - [SerperDev](https://serper.dev/) (web search)
  - [OpenAI](https://platform.openai.com/) (AI analysis)

## 🛠️ Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/finance-agent.git
   cd finance-agent
   ```

2. Install dependencies:
   ```bash
   pnpm install
   # or
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

   Update `.env` with your API keys:
   ```env
   ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key_here
   SERPER_API_KEY=your_serper_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

## 🏗️ Architecture

The workflow consists of several specialized steps that work together to provide comprehensive financial analysis:

![Finance Agent](./docs/finance-agent.png)


## 🚦 API Endpoints

### Query Endpoint

```http
POST /finance-query
Content-Type: application/json

{
  "query": "Latest information about AAPL and MSFT"
}
```

Response:
```json
{
  "message": "Query received and processing started",
  "traceId": "abc123def456"
}
```

### Results Endpoint

```http
GET /finance-result/:traceId
```

Response:
```json
{
  "query": "Latest information about AAPL and MSFT",
  "timestamp": "2023-06-15T12:34:56.789Z",
  "response": {
    "summary": "Results for \"Latest information about AAPL and MSFT\"",
    "webResources": [...],
    "financialData": [...],
    "aiAnalysis": {...}
  },
  "status": "success"
}
```

## 🏃‍♂️ Running the Application

1. Start the development server:
   ```bash
   pnpm dev
   ```

2. Access the Motia Workbench:
   ```
   http://localhost:3000
   ```

3. Make a test request:
   ```bash
   curl -X POST http://localhost:3000/finance-query \
     -H "Content-Type: application/json" \
     -d '{"query": "Latest information about AAPL and MSFT"}'
   ```

## 🧪 Testing

Run the test suite:
```bash
pnpm test
```

Run tests in watch mode:
```bash
pnpm test --watch
```

## 📦 Deployment

1. Build the application:
   ```bash
   pnpm build
   ```

2. Start in production mode:
   ```bash
   pnpm start
   ```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Motia Framework](https://motia.dev) for the event-driven workflow engine
- [Alpha Vantage](https://www.alphavantage.co/) for financial data
- [SerperDev](https://serper.dev/) for web search capabilities
- [OpenAI](https://platform.openai.com/) for AI analysis 