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
        
        strategy = boundaries_response.content
        
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
        """
        
        eval_response: RunResponse = await code_review_agent.arun(
            eval_prompt,
            response_model=Evaluation,
            use_structured_output=True
        )
        
        return eval_response.content
        
    except Exception as e:
        print(f"Error in evaluate_commits: {e}")
        # Fallback to general-purpose agent
        try:
            fallback_response = await fallback_agent.arun(
                f"""
                Evaluate these code changes against the given requirements.
                
                Requirements:
                {requirements}
                
                Files Changed:
                {commits.files}
                
                Commit Messages:
                {commits.messages}
                
                Provide a JSON response with this structure:
                {{
                    "score": 0.5,  # between 0.0 and 1.0
                    "issues": [
                        {{
                            "claim": "Main assertion about an issue",
                            "grounds": "Evidence supporting the claim",
                            "warrant": "Reasoning connecting grounds to claim",
                            "backing": "Support for the warrant",
                            "qualifier": "Conditions or limits on the claim"
                        }}
                    ],
                    "summary": "Overall evaluation summary",
                    "issueSummary": "Summary of identified issues"
                }}
                """,
                use_json_mode=True
            )
            
            data = json.loads(fallback_response.content)
            return Evaluation(**data)
        except Exception as fallback_error:
            print(f"Fallback evaluation failed: {fallback_error}")
            # Ultimate fallback
            return Evaluation(
                score=0.5,
                issues=[Issue(
                    claim="Evaluation failed due to API error",
                    grounds="The error occurred during commit evaluation",
                    warrant="API errors indicate temporary service unavailability",
                    backing="Error logs show API failure",
                    qualifier="This is a fallback response"
                )],
                summary="Unable to complete evaluation due to service error",
                issueSummary="Fallback response generated due to API error"
            )

async def evaluate_reasoning(
    parent_state: str,
    expanded_states: List[str],
    expanded_node_ids: Optional[List[str]] = None
) -> SimulationResult:
    """
    Evaluates the quality of reasoning paths in the simulation phase of MCTS.
    """
    if not expanded_states:
        raise ValueError("No expanded states to evaluate")
        
    try:
        # Select a random state to evaluate (as per MCTS simulation policy)
        idx = random.randrange(len(expanded_states))
        selected_state = expanded_states[idx]
        selected_id = expanded_node_ids[idx] if expanded_node_ids and idx < len(expanded_node_ids) else f"state_{idx}"
        
        # Use the specialized reasoning evaluation agent
        eval_prompt = f"""
        Evaluate this reasoning path for solving a software development problem.
        
        Initial reasoning:
        {parent_state}
        
        Next step in reasoning:
        {selected_state}
        """
        
        response: RunResponse = await reasoning_eval_agent.arun(
            eval_prompt,
            response_model=ReasoningEvaluation,
            use_structured_output=True
        )
        
        # Create simulation result
        return SimulationResult(
            nodeId=selected_id,
            value=response.content.value,
            explanation=response.content.explanation
        )
        
    except Exception as e:
        print(f"Error in evaluate_reasoning: {e}")
        # Fallback to general-purpose agent
        try:
            fallback_response = await fallback_agent.arun(
                f"""
                Evaluate this reasoning path for solving a software development problem.
                Rate the quality on a scale from 0.0 to 1.0 and explain your rating.
                
                Initial reasoning:
                {parent_state}
                
                Next step in reasoning:
                {expanded_states[0]}
                
                Return a JSON object with this structure:
                {{
                    "value": 0.5,  # between 0.0 and 1.0
                    "explanation": "Why you assigned this score"
                }}
                """,
                use_json_mode=True
            )
            
            data = json.loads(fallback_response.content)
            
            # Get the node ID
            node_id = expanded_node_ids[0] if expanded_node_ids and len(expanded_node_ids) > 0 else "fallback_node"
            
            return SimulationResult(
                nodeId=node_id,
                value=data.get("value", 0.5),
                explanation=data.get("explanation", "Fallback evaluation")
            )
        except Exception as fallback_error:
            print(f"Fallback reasoning evaluation failed: {fallback_error}")
            # Ultimate fallback
            node_id = expanded_node_ids[0] if expanded_node_ids and len(expanded_node_ids) > 0 else "fallback_node"
            return SimulationResult(
                nodeId=node_id,
                value=0.5,
                explanation="Fallback evaluation due to service error"
            ) 