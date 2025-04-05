# PDF RAG Agent using Motia, Docling and Weaviate

An LLM chat-like question-answering system built with Motia Framework that uses RAG (Retrieval-Augmented Generation) to provide accurate answers from PDF documents.
The system leverages Docling to parse and intelligently chunk PDF documents, Weaviate as a vector database to store vectorized chunks, and OpenAI for embeddings and text generation.

## Features

- PDF document processing and chunking
- Built with Motia Framework for event-driven workflows
- Vector storage using Weaviate
- Docling for PDF parsing and hybrid chunking
- Question answering using RAG pattern
- OpenAI integration for embeddings and text generation

## Prerequisites

- Node.js 18+
- Python 3.x
- Weaviate instance
- OpenAI API key

## Setup

1. Initialize the Node.js and Python dependencies:
```bash
pnpm install
```

1. Create a `.env` file in the root directory with the following variables:
```env
OPENAI_API_KEY=your_openai_api_key
WEAVIATE_URL=your_weaviate_instance_url
WEAVIATE_API_KEY=your_weaviate_api_key
```

## Development

Start the development server:
```bash
pnpm dev
```

For debug mode:
```bash
pnpm dev:debug
```

## Building

Build the project:
```bash
pnpm build
```

## Testing

Run tests:
```bash
pnpm test
```

## Code Quality

Lint code:
```bash
pnpm lint
```

Format code:
```bash
pnpm format
```

## Project Structure
```
src/
├── steps/
│   ├── api-steps/          # API endpoints for PDF processing and querying
│   │   ├── api-process-pdfs.step.ts
│   │   └── api-query-rag.step.ts
│   └── event-steps/        # Background processing steps
│       ├── init-weaviate.step.ts
│       ├── load-weaviate.step.ts
│       └── process-pdfs.step.py
│       └── read-pdfs.step.ts
├── types/               # TypeScript type definitions
```

The project follows a modular structure aligned with Motia Framework conventions:

- `steps/`: Contains all workflow steps
  - `api-steps/`: HTTP endpoints for PDF processing and querying
  - `event-steps/`: Background processing steps for chunking, embedding, and answer generation
- `services/`: Core business logic modules
- `types/`: TypeScript type definitions
- `utils/`: Helper functions and utilities
- `middlewares/`: API request/response middleware

## How it Works

1. **Document Processing**: The system processes the PDF using Docling and uses Hybrind Chunking to split it into chunks
1. **Vector Storage**: Text chunks are embedded using Open AI and stored in Weaviate
1. **Query Processing**: User queries are processed using RAG:
   - Query is embedded and similar chunks are retrieved from Weaviate
   - Retrieved context and query are sent to OpenAI for answer generation
   - Response is returned to the user

## API Endpoints

- `POST /api/rag/process-pdfs`: Start processing PDF documents
- `POST /api/rag/query`: Submit questions about the documents

## License

MIT
