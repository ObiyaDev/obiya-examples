from typing import Dict, List, Optional
import random
import json
from agno.agent import RunResponse, Message

from steps.shared.models import (
    Node, NodeExpansion, Issue, Evaluation, SimulationResult, 
    NodeSelectionResponse, ReasoningEvaluation
)
from steps.shared.repositories import Commits
from steps.shared.agents import (
    mcts_agent, expansion_agent, code_review_agent,
    system_analysis_agent, reasoning_eval_agent, fallback_agent
)

# ====================
# Main Functions
# ====================

async def expand_node(current_node: str) -> NodeExpansion:
    """
    Expands a node by generating possible next reasoning steps.
    """
    try:
        # Use the specialized expansion agent with detailed structure
        prompt = f"""
        I need to expand on a current reasoning state about code design.
        Generate 2-3 distinct next steps that would be valuable to explore further.
        
        Current reasoning state:
        {current_node}
        """
        
        response: RunResponse = await expansion_agent.arun(
            prompt,
            response_model=NodeExpansion,
            use_structured_output=True
        )
        
        return response.content
        
    except Exception as e:
        print(f"Error in expand_node: {e}")
        # Fallback to the general-purpose agent
        try:
            fallback_response = await fallback_agent.arun(
                f"""
                Generate 2-3 distinct next steps in reasoning about this code design state:
                {current_node}
                
                Return a JSON object with this structure:
                {{
                    "reasoning": "explanation of your thought process",
                    "steps": ["step 1", "step 2", "step 3"]
                }}
                """,
                use_json_mode=True
            )
            
            # Parse JSON response
            data = json.loads(fallback_response.content)
            return NodeExpansion(**data)
        except Exception as fallback_error:
            print(f"Fallback expansion failed: {fallback_error}")
            # Ultimate fallback - hardcoded response
            return NodeExpansion(
                reasoning="Fallback expansion due to API error",
                steps=["Analyze code structure", "Review error handling", "Consider performance implications"]
            )

async def evaluate_commits(commits: Commits, requirements: str) -> Evaluation:
    """
    Evaluates a set of commits against given requirements using the Toulmin Model.
    """
    try:
        # Step 1: Analyze system boundaries using the specialized agent
        boundaries_prompt = f"""
        Analyze the system boundaries and strategic approach in these code changes:
        
        Files Changed:
        {commits.files}
        
        Commit Messages:
        {commits.messages}
        
        Diff:
        {commits.diff}
        
        Describe the strategy employed by the developer, the system components being 
        modified, and how they interact within the broader system.
        """
        
        boundaries_response = await system_analysis_agent.arun(boundaries_prompt)
        
        strategy = boundaries_response.content if isinstance(boundaries_response.content, str) else "Strategy analysis not available"
        
        # Step 2: Perform code review using the specialized Toulmin model agent
        eval_prompt = f"""
        Perform a thorough code review using the Toulmin Model of Argumentation.
        
        Requirements:
        {requirements}
        
        System Analysis:
        {strategy}
        
        Files Changed:
        {commits.files}
        
        Commit Messages:
        {commits.messages}
        
        Diff:
        {commits.diff}
        
        Return a JSON structure with these fields:
        - score: A number between 0 and 1 representing the overall quality
        - issues: An array of objects, each with claim, grounds, warrant, backing, and qualifier fields
        - summary: A string summarizing the overall evaluation
        - issueSummary: A string summarizing the issues found
        """
        
        # Create default evaluation in case of failure
        default_evaluation = Evaluation(
            score=0.5,
            issues=[Issue(
                claim="Code review completed with default evaluation",
                grounds="The review system encountered issues with the AI response",
                warrant="Default evaluations are used when structured data cannot be parsed",
                backing="System logs show response parsing errors",
                qualifier="This is a default response"
            )],
            summary="Code review completed with limited data. The system was unable to generate a detailed analysis.",
            issueSummary="No specific issues could be identified due to response processing errors."
        )
        
        try:
            eval_response = await code_review_agent.arun(
                eval_prompt,
                response_model=Evaluation,
                use_structured_output=True,
                use_json_mode=True
            )
            
            # Handle various response types
            if eval_response and hasattr(eval_response, 'content'):
                content = eval_response.content
                
                # If it's already an Evaluation object, return it
                if isinstance(content, Evaluation):
                    return content
                
                # If it's a string, try to parse as JSON
                if isinstance(content, str):
                    try:
                        # Check if string is a markdown code block with JSON
                        content_str = content.strip()
                        json_str = None
                        
                        # Case 1: Markdown code block with JSON
                        if content_str.startswith("```json") and "```" in content_str:
                            # Extract JSON content from markdown code block
                            json_str = content_str.replace("```json", "", 1)  # Remove first ```json
                            json_str = json_str.split("```")[0].strip()  # Get content up to closing ```
                            print(f"Extracted JSON from markdown code block: {json_str[:100]}...")
                        # Case 2: Markdown code block without language specifier
                        elif content_str.startswith("```") and "```" in content_str:
                            json_str = content_str.replace("```", "", 1)  # Remove first ```
                            json_str = json_str.split("```")[0].strip()  # Get content up to closing ```
                            print(f"Extracted JSON from generic markdown block: {json_str[:100]}...")
                        # Case 3: Raw JSON
                        else:
                            json_str = content_str
                            print(f"Using raw string as JSON: {json_str[:100]}...")
                            
                        # Parse the extracted JSON
                        if json_str:
                            data = json.loads(json_str)
                        else:
                            # Fallback if no JSON found
                            data = {"value": 0.5, "explanation": "Could not extract JSON"}
                        
                        # Extract values from parsed JSON
                        if isinstance(data, dict):
                            # Extract score - check both 'value' and 'score' fields
                            value = float(data.get('value', data.get('score', 0.5)))
                            
                            # Handle explanation in different formats
                            if 'explanation' in data:
                                if isinstance(data['explanation'], dict):
                                    # If explanation is an object with fields, convert to string
                                    explanation_parts = []
                                    for key, val in data['explanation'].items():
                                        if isinstance(val, str):
                                            explanation_parts.append(f"{key.replace('_', ' ').title()}: {val}")
                                    explanation = "\n".join(explanation_parts)
                                else:
                                    explanation = str(data['explanation'])
                            else:
                                explanation = f"Evaluation score: {value}"
                            
                            return Evaluation(
                                score=value,
                                issues=[Issue(
                                    claim="Evaluation used fallback parsing",
                                    grounds="The API returned an unparseable response",
                                    warrant="API errors suggest issues with structured output",
                                    backing="Error logs show JSON parsing failure",
                                    qualifier="This is a fallback response"
                                )],
                                summary=explanation,
                                issueSummary="Used string response as summary due to parsing errors"
                            )
                        else:
                            # Data is not a dict
                            return Evaluation(
                                score=0.5,
                                issues=[Issue(
                                    claim="Evaluation used fallback parsing",
                                    grounds="The API returned an unparseable response",
                                    warrant="API errors suggest issues with structured output",
                                    backing="Error logs show JSON parsing failure",
                                    qualifier="This is a fallback response"
                                )],
                                summary=f"Unexpected JSON structure: {str(data)[:200]}",
                                issueSummary="Used string response as summary due to parsing errors"
                            )
                    except Exception as json_error:
                        print(f"Error parsing JSON response: {json_error}")
                        # Create an evaluation using the string content as the summary
                        return Evaluation(
                            score=0.5,
                            issues=[Issue(
                                claim="Evaluation used fallback parsing",
                                grounds="The API returned an unparseable response",
                                warrant="API errors suggest issues with structured output",
                                backing="Error logs show JSON parsing failure",
                                qualifier="This is a fallback response"
                            )],
                            summary=str(content)[:500],  # Limit to 500 chars
                            issueSummary="Used string response as summary due to parsing errors"
                        )
                
                # If it's a dict, try to create an Evaluation
                if isinstance(content, dict):
                    try:
                        return Evaluation(**content)
                    except Exception as dict_error:
                        print(f"Error creating Evaluation from dict: {dict_error}")
                        return default_evaluation
            
            # If we couldn't process the response properly, return default
            return default_evaluation
            
        except Exception as eval_error:
            print(f"Error in code review evaluation: {eval_error}")
            return default_evaluation
            
    except Exception as e:
        print(f"Error in evaluate_commits: {e}")
        # Ultimate fallback
        return Evaluation(
            score=0.5,
            issues=[Issue(
                claim="Evaluation failed due to system error",
                grounds="The error occurred during commit evaluation",
                warrant="System errors indicate potential processing issues",
                backing="Error logs show evaluation failure",
                qualifier="This is a fallback response"
            )],
            summary="Unable to complete evaluation due to system error",
            issueSummary="Fallback response generated due to system error"
        )

async def evaluate_reasoning(
    parent_state: str,
    expanded_states: List[str],
    expanded_node_ids: Optional[List[str]] = None
) -> SimulationResult:
    """
    Evaluates the quality of reasoning paths in the simulation phase of MCTS.
    
    Returns:
        SimulationResult: Always returns a valid SimulationResult object, even on error.
    """
    if not expanded_states:
        selected_id = 'fallback_node'
        if expanded_node_ids and len(expanded_node_ids) > 0:
            selected_id = expanded_node_ids[0]
        return SimulationResult(
            nodeId=selected_id,
            value=0.5,
            explanation="No expanded states to evaluate"
        )
        
    try:
        # Select a random state to evaluate (as per MCTS simulation policy)
        idx = random.randrange(len(expanded_states))
        selected_state = expanded_states[idx]
        selected_id = expanded_node_ids[idx] if expanded_node_ids and idx < len(expanded_node_ids) else f"state_{idx}"
        
        # Construct a simple prompt to evaluate the reasoning path
        eval_prompt = f"""
        Evaluate this reasoning step in a code review thought process.
        
        Initial reasoning state:
        {parent_state}
        
        Considered next step:
        {selected_state}
        
        Rate how promising this reasoning path is on a scale from 0.0 to 1.0.
        Consider logical coherence, technical relevance, and problem-solving value.
        
        Return a detailed explanation of your evaluation and a score.
        """
        
        try:
            # Use the specialized reasoning evaluation agent
            eval_response = await reasoning_eval_agent.arun(
                eval_prompt,
                response_model=ReasoningEvaluation,
                use_structured_output=True
            )
            
            # Log response for debugging
            print(f"Evaluation response: {type(eval_response)} - {eval_response}")
            
            # If the response is None, return a fallback
            if not eval_response:
                print("Null response from evaluation agent")
                return SimulationResult(
                    nodeId=selected_id,
                    value=0.5,
                    explanation="Null response from evaluation agent"
                )
            
            # Process based on response content
            if hasattr(eval_response, 'content'):
                content = eval_response.content
                
                # Handle different types of content
                if isinstance(content, ReasoningEvaluation):
                    # Direct ReasoningEvaluation object
                    return SimulationResult(
                        nodeId=selected_id,
                        value=content.value,
                        explanation=content.explanation
                    )
                elif isinstance(content, dict):
                    # Dictionary with compatible fields
                    value = float(content.get('value', content.get('score', 0.5)))
                    explanation = content.get('explanation', 'Evaluation from dict')
                    return SimulationResult(
                        nodeId=selected_id,
                        value=value,
                        explanation=explanation
                    )
                elif isinstance(content, str):
                    # String that might be JSON or markdown code block with JSON
                    try:
                        # Check if string is a markdown code block with JSON
                        content_str = content.strip()
                        json_str = None
                        
                        # Case 1: Markdown code block with JSON
                        if content_str.startswith("```json") and "```" in content_str:
                            # Extract JSON content from markdown code block
                            json_str = content_str.replace("```json", "", 1)  # Remove first ```json
                            json_str = json_str.split("```")[0].strip()  # Get content up to closing ```
                            print(f"Extracted JSON from markdown code block: {json_str[:100]}...")
                        # Case 2: Markdown code block without language specifier
                        elif content_str.startswith("```") and "```" in content_str:
                            json_str = content_str.replace("```", "", 1)  # Remove first ```
                            json_str = json_str.split("```")[0].strip()  # Get content up to closing ```
                            print(f"Extracted JSON from generic markdown block: {json_str[:100]}...")
                        # Case 3: Raw JSON
                        else:
                            json_str = content_str
                            print(f"Using raw string as JSON: {json_str[:100]}...")
                            
                        # Parse the extracted JSON
                        if json_str:
                            data = json.loads(json_str)
                        else:
                            # Fallback if no JSON found
                            data = {"value": 0.5, "explanation": "Could not extract JSON"}
                        
                        # Extract values from parsed JSON
                        if isinstance(data, dict):
                            # Extract score - check both 'value' and 'score' fields
                            value = float(data.get('value', data.get('score', 0.5)))
                            
                            # Handle explanation in different formats
                            if 'explanation' in data:
                                if isinstance(data['explanation'], dict):
                                    # If explanation is an object with fields, convert to string
                                    explanation_parts = []
                                    for key, val in data['explanation'].items():
                                        if isinstance(val, str):
                                            explanation_parts.append(f"{key.replace('_', ' ').title()}: {val}")
                                    explanation = "\n".join(explanation_parts)
                                else:
                                    explanation = str(data['explanation'])
                            else:
                                explanation = f"Evaluation score: {value}"
                            
                            return SimulationResult(
                                nodeId=selected_id,
                                value=value,
                                explanation=explanation
                            )
                        else:
                            # Data is not a dict
                            return SimulationResult(
                                nodeId=selected_id,
                                value=0.5,
                                explanation=f"Unexpected JSON structure: {str(data)[:200]}"
                            )
                    except Exception as json_error:
                        print(f"JSON parsing error: {json_error}, Content: {content[:100]}")
                        # Return a fallback with the string content as explanation
                        return SimulationResult(
                            nodeId=selected_id,
                            value=0.5,
                            explanation=f"Failed to parse JSON: {content[:200]}"
                        )
                else:
                    # Unknown content type
                    content_type = type(content).__name__
                    print(f"Unexpected content type: {content_type}")
                    return SimulationResult(
                        nodeId=selected_id,
                        value=0.5,
                        explanation=f"Unexpected content type: {content_type}"
                    )
            else:
                # No content attribute
                print("Response missing content attribute")
                return SimulationResult(
                    nodeId=selected_id,
                    value=0.5,
                    explanation="Response missing content attribute"
                )
                
        except Exception as eval_error:
            # Error during evaluation agent call
            print(f"Evaluation agent error: {eval_error}")
            return SimulationResult(
                nodeId=selected_id,
                value=0.5,
                explanation=f"Evaluation error: {str(eval_error)}"
            )
            
    except Exception as e:
        # Any other error in the function
        print(f"General evaluate_reasoning error: {e}")
        # Select the first node ID if available, or use a fallback ID
        selected_id = expanded_node_ids[0] if expanded_node_ids and len(expanded_node_ids) > 0 else "fallback_node"
        return SimulationResult(
            nodeId=selected_id,
            value=0.5,
            explanation=f"Error in evaluate_reasoning: {str(e)}"
        ) 