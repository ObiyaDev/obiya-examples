import os
import pathlib
import subprocess

config = {
    'type': 'event',
    'name': 'Index & Save',
    'description': 'Reads Embedding files from temp/embeddings, indexes them in Faiss and saves the index to temp/faiss_files',
    'subscribes': ['chunk.complete', 'embed.complete'],
    'emits': ['index.complete'],
    'flows': ['parse-embed-rag'],
}

async def handler(req, ctx):
    script_path = pathlib.Path().parent / "src" / "index.py"
    
    try:
        subprocess.run(["python", str(script_path)])
        ctx.logger.info("Embedded data was indexed successfully!")
    except Exception as e:
        ctx.logger.info(f"Error indexing embedded text: {e}")
    
    await ctx.emit({
        'topic': 'index.complete',
        'data': {'message': 'indexing completed'}
    })
    return