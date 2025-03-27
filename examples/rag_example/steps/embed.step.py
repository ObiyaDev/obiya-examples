import pathlib
import subprocess
import os

config = {
    'type': 'event',
    'name': 'Embed & Save',
    'description': 'Reads chunked data, embeds and saves it to temp/embeddings',
    'subscribes': ['chunk.complete'],
    'emits': ['embed.complete'],
    'flows': ['parse-embed-rag'],
}

async def handler(req, ctx):
    script_path = pathlib.Path().parent / "src" / "embed.py"
    try:
        subprocess.run(["python", str(script_path)])
        ctx.logger.info("Chunked Text was embedded successfully!")
    except Exception as e:
        ctx.logger.info(f"Error embedding chunked text: {e}")
    
    await ctx.emit({
        'topic': 'embed.complete',
        'data': {'message': 'embedding completed'}
    })
    return