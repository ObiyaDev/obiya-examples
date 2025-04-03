# PDF RAG Agent using Motia and Weaviate

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
