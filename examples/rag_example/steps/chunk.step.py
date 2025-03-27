import json
import pathlib
import subprocess
import logging

config = {
    'type': 'event',
    'name': 'Chunk & Save',
    'description': 'Reads raw text from temp/text, chunks and saves to temp/chunks',
    'subscribes': ['parse.complete'],
    'emits': ['chunk.complete'],
    'flows': ['parse-embed-rag'],
}

async def handler(req, ctx):
    """
    Handler function to run the chunking script and emit the completion event.

    Args:
        req: The request object.
        ctx: The context object.
    """
    script_path = pathlib.Path().parent.parent / "src" / "chunk.py"
    
    try:
        result = subprocess.run(["python3", str(script_path)], capture_output=True, text=True)
        if result.returncode == 0:
            ctx.logger.info("Parsed website text was read, chunked, and saved")
        else:
            ctx.logger.error(f"Error chunking parsed website data: {result.stderr}")
    except Exception as e:
        ctx.logger.error(f"Error chunking parsed website data: {e}")
    
    await ctx.emit({
        'topic': 'chunk.complete',
        'data': {'message': 'chunking completed'}
    })
    return