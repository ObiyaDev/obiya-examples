import sys
import pathlib
import os

src_path = pathlib.Path().parent / "src" 
sys.path.append(str(src_path))  

from rag import rag_reponse

config = {
    'type': 'api',
    'name': 'Rag API',
    'description' : 'performs RAG for a given query and indexed data in temp',
    'path': '/api/rag',
    'method':'POST',
    'emits':['rag.completed'],
    'flows':['parse-embed-rag'],
    }

async def handler(req, ctx):
    query = req.body['query']
    ctx.logger.info("Received query: {}".format(query))
    try:
        result = rag_reponse(query)
        message = "RAG response was provided to the user query : {}".format(query)
        ctx.logger.info(message)
    except:
        ctx.logger.info("Error responding to user query")
    
    await ctx.emit({
        'topic':'rag.completed',
        'data':{'message':'rag response provided'}
        })
    
    return{
        'status':200,
        'body': {'answer':result}
        }