# steps/doc-analyzer.step.py
import re
from typing import Dict, Any, List

# Configuration section
config = {
    "type": "event",
    "name": "doc-analyzer",
    "subscribes": ["documentation-analysis-started"],
    "emits": ["doc-gaps-identified"],
    "flows": ["documentation-guardian"]
}

# Handler function
def handler(payload, context):
    logger = context.logger
    emit = context.emit
    
    logger.info(f"Analyzing documentation for {payload['file']}")
    
    file_content = payload['content']
    file_path = payload['file']
    file_extension = file_path.split('.')[-1]
    
    # Different analysis strategies based on file type
    if file_extension in ['js', 'ts']:
        doc_gaps = analyze_js_ts(file_content)
    elif file_extension == 'py':
        doc_gaps = analyze_python(file_content)
    else:
        doc_gaps = analyze_generic(file_content)
    
    if not doc_gaps:
        logger.info(f"No documentation gaps found in {file_path}")
        return
    
    # Emit an event with the documentation gaps
    emit({
        "topic": "doc-gaps-identified",
        "data": {
            **payload,
            "gaps": doc_gaps
        }
    })

def analyze_js_ts(content):
    # Simple example - in reality, use an AST parser for better analysis
    functions = re.findall(r'(function\s+(\w+)|(\w+)\s*=\s*function|\(\s*\)\s*=>\s*{)', content)
    classes = re.findall(r'class\s+(\w+)', content)
    
    gaps = []
    
    # Check for missing JSDoc comments
    for match in functions:
        func_name = match[1] or match[2] or "anonymous"
        pattern = rf'/\*\*[\s\S]*?\*/\s*function\s+{func_name}|/\*\*[\s\S]*?\*/\s*{func_name}\s*='
        if not re.search(pattern, content):
            gaps.append({
                "type": "function",
                "name": func_name,
                "issue": "Missing JSDoc comment"
            })
    
    for class_name in classes:
        pattern = rf'/\*\*[\s\S]*?\*/\s*class\s+{class_name}'
        if not re.search(pattern, content):
            gaps.append({
                "type": "class",
                "name": class_name,
                "issue": "Missing class documentation"
            })
    
    return gaps

def analyze_python(content):
    # Check for missing docstrings
    functions = re.findall(r'def\s+(\w+)\s*\(', content)
    classes = re.findall(r'class\s+(\w+)', content)
    
    gaps = []
    
    for func_name in functions:
        pattern = rf'def\s+{func_name}\s*\([^)]*\):\s*([\'"]{{3}}|[\""]{{3}})'
        if not re.search(pattern, content):
            gaps.append({
                "type": "function",
                "name": func_name,
                "issue": "Missing docstring"
            })
    
    for class_name in classes:
        pattern = rf'class\s+{class_name}[^:]*:\s*([\'"]{{3}}|[\""]{{3}})'
        if not re.search(pattern, content):
            gaps.append({
                "type": "class",
                "name": class_name,
                "issue": "Missing class docstring"
            })
    
    return gaps

def analyze_generic(content):
    # Basic heuristic for other languages
    # In reality, you'd want language-specific analyzers
    lines = content.split('\n')
    gaps = []
    
    for i, line in enumerate(lines):
        if re.search(r'(function|def|class|interface|struct)\s+\w+', line) and i > 0:
            # Check if previous lines have comments
            has_comment = False
            for j in range(max(0, i-3), i):
                if '//' in lines[j] or '/*' in lines[j] or '#' in lines[j]:
                    has_comment = True
                    break
            
            if not has_comment:
                match = re.search(r'(function|def|class|interface|struct)\s+(\w+)', line)
                if match:
                    gaps.append({
                        "type": match.group(1),
                        "name": match.group(2),
                        "issue": "Missing documentation comment"
                    })
    
    return gaps