import pathlib
import subprocess

config = {
    'type': 'api',
    'name': 'Parser API',
    'description': 'Parses and chunks a given url and saves it to temp/chunks',
    'path': '/api/parse',
    'method': 'POST',
    'emits': ['parse.complete'],
    'flows': ['parse-embed-rag'],
}

async def handler(req, ctx):
    input_url = req.body['url']

    ctx.logger.info("Received URL: {}".format(input_url))
    script_path = pathlib.Path().parent / "src" / "parse.py"
    
    try:
        subprocess.run(["python", str(script_path), input_url])
        ctx.logger.info("Website was parsed, and text was saved")
    except Exception as e:
        ctx.logger.info(f"Error parsing website text: {e}")
    
    await ctx.emit({
        'topic': 'parse.complete',
        'data': {'message': 'Parsing completed'}
    })
    
    return {
        'status': 200,
        'body': {'status': "motia parse-chunk-embed-index initiated"}
    }

