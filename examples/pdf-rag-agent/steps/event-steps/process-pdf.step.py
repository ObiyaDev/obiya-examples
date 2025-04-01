import os
from typing import Dict, Any
from docling.document_converter import DocumentConverter
from docling.chunking import HybridChunker
from transformers import AutoTokenizer
import torch

# Set environment variable to avoid tokenizer parallelism warning
os.environ["TOKENIZERS_PARALLELISM"] = "false"

config = {
    "type": "event",
    "name": "process-pdf",
    "flows": ["rag-workflow"],
    "subscribes": ["rag.process.pdf"],
    "emits": [{ "topic": "rag.chunks.ready", "label": "PDF chunks ready" }],
    "input": None # No schema validation for Python right now
    # input.stateKey: str
}

async def handler(input, context):
    context.logger.info('Processing input:', input)
    
    # Get file info from input
    file_path = input.filePath
    filename = input.fileName
    
    context.logger.info(f"Processing PDF file: {filename}")

    # Initialize Docling converter and chunker
    converter = DocumentConverter()
    EMBED_MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
    MAX_TOKENS = 1024

    tokenizer = AutoTokenizer.from_pretrained(EMBED_MODEL_ID)
    chunker = HybridChunker(
        tokenizer=tokenizer,
        max_tokens=MAX_TOKENS,
    )

    # In case of the warning:
    #  Token indices sequence length is longer than the specified maximum sequence length for this model (554 > 512).
    #  Running this sequence through the model will result in indexing errors
    #  https://docling-project.github.io/docling/faq/#hybridchunker-triggers-warning-token-indices-sequence-length-is-longer-than-the-specified-maximum-sequence-length-for-this-model
    
    # Check if GPU or MPS is available
    if torch.cuda.is_available():
        device = torch.device("cuda")
        context.logger.info(f"Using CUDA GPU: {torch.cuda.get_device_name(0)}")
    elif torch.backends.mps.is_available():
        device = torch.device("mps")
        context.logger.info("Using MPS GPU")
    else:
        device = torch.device("cpu")
        context.logger.info("Using CPU")

    # Process the PDF
    chunks = []
    try:
        # Convert PDF to Docling document
        result = converter.convert(file_path)
        doc = result.document

        # Get chunks using the chunker
        for chunk in chunker.chunk(dl_doc=doc):
            chunks.append({
                "text": chunk.text,
                "title": os.path.splitext(filename)[0],
                "metadata": {
                    "source": filename,
                    "page": chunk.page_number if hasattr(chunk, 'page_number') else 1
                }
            })

    except Exception as e:
        context.logger.error(f"Error processing {filename}: {str(e)}")
        raise e

    context.logger.info(f"Processed {len(chunks)} chunks from PDF")

    # Save chunks to state
    chunks_state_key = f"chunks_{state_key}"
    await context.state.set('rag-workflow', chunks_state_key, chunks)
    context.logger.info(f"Saved chunks to state with key: {chunks_state_key}")

    # cleanup file info from state
    await context.state.delete('rag-workflow', state_key)

    # Emit state key instead of chunks
    await context.emit({
        "topic": "rag.chunks.ready",
        "data": {
            "stateKey": chunks_state_key
        }
    }) 