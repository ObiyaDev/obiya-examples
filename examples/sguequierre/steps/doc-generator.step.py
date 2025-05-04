# steps/doc-generator.step.py
import os
from openai import OpenAI
from typing import Dict, Any

# Configuration section
config = {
    "type": "event",
    "name": "doc-generator",
    "subscribes": ["doc-gaps-identified"],
    "emits": ["documentation-generated"],
    "flows": ["documentation-guardian"]
}

# Initialize the OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Handler function
def handler(payload, context):
    logger = context.logger
    emit = context.emit
    
    logger.info(f"Generating documentation for {payload['file']}")
    
    file_content = payload.get('content', '')
    gaps = payload.get('gaps', [])
    file_extension = payload['file'].split('.')[-1]
    
    for gap in gaps:
        # Extract the code segment needing documentation
        code_segment = extract_code_segment(file_content, gap, file_extension)
        
        # Generate documentation using an LLM
        doc_comment = generate_documentation(code_segment, gap, file_extension)
        
        gap['generated_doc'] = doc_comment
    
    emit({
        "topic": "documentation-generated",
        "data": {
            **payload,
            "gaps": gaps
        }
    })

def extract_code_segment(content, gap, file_extension):
    # This is a simplified implementation
    # In a real system, use an AST parser for better code extraction
    if not content:
        return ""
        
    lines = content.split('\n')
    
    # Simple pattern matching to find the relevant code block
    pattern = f"{gap['type']}\\s+{gap['name']}"
    import re
    
    for i, line in enumerate(lines):
        if re.search(pattern, line):
            # Extract a reasonable context (the function or class definition)
            start = i
            end = i
            
            # Find the end of the block (simplistic approach)
            brackets = 0
            in_block = False
            
            for j in range(i, min(i + 100, len(lines))):
                if '{' in lines[j]:
                    brackets += 1
                    in_block = True
                if '}' in lines[j]:
                    brackets -= 1
                
                end = j
                
                # Different languages have different block styles
                if file_extension in ['py']:
                    # For Python, look for consistent indentation
                    if j > i and (j+1 >= len(lines) or 
                                 (lines[j+1].strip() and not lines[j+1].startswith('    '))):
                        break
                elif in_block and brackets == 0:
                    # For C-style languages, track braces
                    break
            
            # Return the relevant code segment
            return '\n'.join(lines[start:end+1])
    
    return ""

def generate_documentation(code_segment, gap, file_extension):
    # Prepare a prompt for the LLM
    prompt = f"""
    Write a clear and concise documentation comment for the following code.
    
    Code:
    ```{file_extension}
    {code_segment}
    ```
    
    Documentation format: {'JSDoc' if file_extension in ['js', 'ts'] else 'Docstring' if file_extension == 'py' else 'Comment'}
    
    Generate only the documentation comment, nothing else.
    """
    
    try:
        # Call the OpenAI API
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a technical documentation expert."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        
        # Extract the generated documentation
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"/* Error generating documentation: {str(e)} */"