import ultraimport
from vision_agent.lmm import AnthropicLMM

download_image = ultraimport('__dir__/download_image.py', 'download_image')

config = {
    "type": "event",
    "name": "Vision agent - evaluate vision result",
    "subscribes": ['evaluate-image'], 
    "emits": ['eval-report'],
    "input": None,  # No schema validation in Python version
    "flows": ['generate-image'],
}

async def handler(args, ctx):
    print('evaluate vision result', args)
    image = download_image(args.image)
    lmm = AnthropicLMM()
    prompt = "Evaluate if the image is a good representation of the following prompt: \n\n" + args.prompt + "\n\n If the image is not a good representation, return a score between 0 and 100, 100 being the most accurate representation. If the image is a good representation, return 100."
    response = lmm(prompt, media=[image])
    
    try:
        score = float(response)
        if score > 90:
            print('image is a good representation', score)
            
            await ctx.emit({
            "type": 'generate-image-result',
            "data": {
                "image": args.image,
                "result": response,
                "score": score
            }
            })
        else:
            print('image is not a good representation, try again', score)
        
    except ValueError:
        print('Invalid response from vision agent', response)