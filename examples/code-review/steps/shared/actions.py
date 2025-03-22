from dataclasses import dataclass
from typing import Dict, List, Optional, Any
from uuid import UUID
import random
import os
import json
from dotenv import load_dotenv
from agno.agent import Agent, RunResponse, Message
from agno.agent.agent import AgentKnowledge, AgentMemory
from agno.models.anthropic import Claude
from agno.models.openai import OpenAIChat
from agno.models.openrouter import OpenRouter
from agno.models.base import Model
from agno.tools import tool
from pydantic import BaseModel, Field
import subprocess
from pathlib import Path

# Load environment variables
load_dotenv()

# ====================
# Specialized Agents
# ====================

# Agent for Monte Carlo Tree Search node selection
mcts_agent = Agent(
    model=OpenRouter(id="deepseek/deepseek-r1"),
    description="Expert in Monte Carlo Tree Search (MCTS) algorithms",
    instructions="""You are an expert in Monte Carlo Tree Search algorithms.
    Your job is to select the optimal node for exploration based on UCB1 algorithm.
    Consider the balance between exploration and exploitation based on node visits and values.
    """
)

# Agent for code reasoning pattern expansion
expansion_agent = Agent(
    model=Claude(id="claude-3-7-sonnet-20250219"),
    description="Expert software engineer analyzing code reasoning patterns",
    instructions="""You are an expert software engineer who specializes in exploring reasoning paths.
    Given a partial reasoning state about code design, your task is to generate possible next steps 
    that would be valuable to explore further. Each step should be a clear and focused statement
    that moves the reasoning process forward in a useful direction.
    
    Generate reasoning paths that are:
    1. Diverse - explore different angles and approaches
    2. Specific - provide concrete, actionable next steps
    3. Insightful - demonstrate deep understanding of software engineering principles
    """
)
# Cost | Coding | Reasoning | Analysis | Provider   | Model
# 10   | 10     | 7         | 8        | Claude     | claude-3-7-sonnet-20250219
# 3    | 7      | 6         | 6        | Gemini     | gemini-2.0-flash-001
# 7    | 5      | 6         | 6        | OpenAI     | gpt-4o-mini
# 5    | 5      | 9         | 7        | OpenRouter | deepseek/deepseek-r1

# Agent for commit evaluation using Toulmin model
code_review_agent = Agent(
    model=OpenRouter(id="google/gemini-1.5-pro-latest"),
    description="Expert software reviewer using Toulmin model",
    instructions="""You are an expert software reviewer who uses the Toulmin Model of Argumentation.
    Given a set of commits, you'll evaluate code changes against specified requirements.
    Break down your analysis using the Toulmin Model:
    
    1. Claims: Assertions about the code's quality, functionality, or compliance
    2. Grounds: Evidence supporting those claims (specific code examples)
    3. Warrants: Reasoning connecting grounds to claims (software principles)
    4. Backing: Support for your warrants (industry standards, best practices)
    5. Qualifiers: Conditions under which claims may not hold
    
    Thoroughly analyze code structure, architecture, potential bugs, security concerns,
    and alignment with specified requirements.
    """
)

# Analysis agent for system boundaries
system_analysis_agent = Agent(
    model=OpenRouter(id="google/gemini-1.5-pro-latest"),
    description="Expert software architect",
    instructions="""You are an expert software architect who specializes in analyzing system boundaries.
    Given a set of code changes and commit messages, your task is to identify the strategy
    employed by the developer and determine the boundaries of the system being modified.
    
    Focus on:
    1. Architecture patterns present in the code
    2. Integration points and interfaces
    3. System components being modified
    4. Dependencies between components
    5. Overall strategy being implemented
    """
)

# Agent for reasoning path evaluation
reasoning_eval_agent = Agent(
    model=OpenRouter(id="deepseek/deepseek-r1"),
    description="Expert evaluator of software reasoning paths",
    instructions="""You are an expert who evaluates the quality of reasoning paths in software development.
    Given an initial reasoning state and a possible next step, your job is to assess
    how promising this path is for solving a software development problem.
    
    Consider:
    1. Logical coherence - Does the step logically follow from the initial state?
    2. Technical soundness - Is the step technically feasible and correct?
    3. Problem relevance - Does the step move closer to solving the original problem?
    4. Creativity - Does the step introduce novel or insightful ideas?
    """
)

# A fallback agent using a simpler model for when other agents fail
fallback_agent = Agent(
    model=OpenRouter(id="google/gemini-2.0-flash-001"),
    description="General-purpose software engineering assistant",
    instructions="""You are a software engineering assistant.
    Provide helpful responses related to code analysis and software design.
    """
)

# ====================
# Model Definitions
# ====================

# Pydantic models for type enforcement
class Node(BaseModel):
    id: str
    parent: Optional[str] = None
    children: List[str] = Field(default_factory=list)
    visits: int = 0
    value: float = 0.0
    state: Optional[str] = None
    isTerminal: Optional[bool] = None

class NodeExpansion(BaseModel):
    reasoning: str = Field(..., description="Explanation of the reasoning process")
    steps: List[str] = Field(..., description="Next steps in the reasoning process")

class Issue(BaseModel):
    claim: str
    grounds: str
    warrant: str
    backing: str
    qualifier: str

class Evaluation(BaseModel):
    score: float
    issues: List[Issue]
    summary: str
    issueSummary: str

class SimulationResult(BaseModel):
    nodeId: str = Field(..., description="ID of the evaluated node")
    value: float = Field(..., ge=0.0, le=1.0, description="Score between 0 and 1")
    explanation: str = Field(..., description="Explanation of the score")

class Commits:
    """Represents changes to a repository since a given commit or event."""
    
    def __init__(self, repo_dir: str, files: str, messages: str, diff: str):
        self.repo_dir = repo_dir
        self.files = files
        self.messages = messages
        self.diff = diff

    @classmethod
    async def create(cls, trace_id: str, state: any, input_data: Dict) -> 'Commits':
        """Create a Commits instance from repository data."""
        repo_dir = input_data.get('repo_dir')
        if not repo_dir:
            raise ValueError("repo_dir is required")
        
        repo_path = Path(os.getcwd()) / repo_dir
        if not repo_path.exists():
            raise ValueError(f"Repository directory not found: {repo_path}")

        # Change to repo directory for git commands
        original_dir = os.getcwd()
        os.chdir(repo_path)
        
        try:
            # Get the list of changed files
            files_cmd = [
                'git', 'diff', '--name-only',
                input_data.get('review_start_commit', 'HEAD~14'),  # Default to last 14 commits
                input_data.get('review_end_commit', 'HEAD')
            ]
            files = subprocess.check_output(files_cmd, text=True)

            # Get commit messages
            messages_cmd = [
                'git', 'log', '--pretty=format:%s',
                f"{input_data.get('review_start_commit', 'HEAD~14')}..{input_data.get('review_end_commit', 'HEAD')}"
            ]
            messages = subprocess.check_output(messages_cmd, text=True)

            # Get the diff, with size limits
            diff_cmd = [
                'git', 'diff',
                input_data.get('review_start_commit', 'HEAD~14'),
                input_data.get('review_end_commit', 'HEAD')
            ]
            
            # Get full diff size first
            diff = subprocess.check_output(diff_cmd, text=True)
            
            # If diff is too large (>1MB), sample it
            MAX_DIFF_SIZE = 1024 * 1024  # 1MB
            if len(diff.encode('utf-8')) > MAX_DIFF_SIZE:
                # Get list of changed files
                changed_files = files.splitlines()
                
                # Randomly sample files until we're under the size limit
                sampled_diff = ""
                sampled_files = []
                while changed_files and len(sampled_diff.encode('utf-8')) < MAX_DIFF_SIZE:
                    # Randomly select a file
                    file_idx = random.randrange(len(changed_files))
                    selected_file = changed_files.pop(file_idx)
                    
                    # Get diff for this file
                    file_diff_cmd = [
                        'git', 'diff',
                        input_data.get('review_start_commit', 'HEAD~14'),
                        input_data.get('review_end_commit', 'HEAD'),
                        '--', selected_file
                    ]
                    try:
                        file_diff = subprocess.check_output(file_diff_cmd, text=True)
                        if len((sampled_diff + file_diff).encode('utf-8')) <= MAX_DIFF_SIZE:
                            sampled_diff += file_diff
                            sampled_files.append(selected_file)
                    except subprocess.CalledProcessError:
                        continue  # Skip files that can't be diffed
                
                # Update files and diff with sampled data
                files = "\n".join(sampled_files)
                diff = sampled_diff

            return cls(str(repo_path), files, messages, diff)
            
        finally:
            # Restore original directory
            os.chdir(original_dir)

# Response models for agent interactions
class NodeSelectionResponse(BaseModel):
    selected_node_id: str = Field(..., description="ID of the selected node")

class ReasoningEvaluation(BaseModel):
    value: float = Field(..., ge=0.0, le=1.0, description="Evaluation score")
    explanation: str = Field(..., description="Explanation of the score")

# ====================
# Tool Definitions
# ====================

@tool("calculate_ucb")
def calculate_ucb(
    node_id: str, 
    visits: int, 
    value: float, 
    parent_visits: int, 
    exploration_constant: float
) -> float:
    """
    Calculate the UCB1 (Upper Confidence Bound) value for a node.
    
    Args:
        node_id: The ID of the node
        visits: Number of visits to this node
        value: Current value of this node
        parent_visits: Number of visits to the parent node
        exploration_constant: The exploration constant for UCB1
        
    Returns:
        The UCB1 value for the node
    """
    if visits == 0:
        return float('inf')  # Prioritize unexplored nodes
    
    exploitation = value / visits
    exploration = exploration_constant * (2 * parent_visits / visits) ** 0.5
    
    return exploitation + exploration

@tool("find_node_with_highest_ucb")
def find_node_with_highest_ucb(
    nodes: Dict[str, Any], 
    parent_id: str,
    exploration_constant: float
) -> str:
    """
    Find the child node with the highest UCB1 value.
    
    Args:
        nodes: Dictionary of nodes
        parent_id: ID of the parent node
        exploration_constant: The exploration constant for UCB1
        
    Returns:
        The ID of the node with highest UCB1 value
    """
    parent_node = nodes[parent_id]
    if not parent_node.children:
        return parent_id
    
    max_ucb = -float('inf')
    best_node_id = None
    
    for child_id in parent_node.children:
        child = nodes[child_id]
        ucb = calculate_ucb(
            child_id, 
            child.visits, 
            child.value, 
            parent_node.visits,
            exploration_constant
        )
        
        if ucb > max_ucb:
            max_ucb = ucb
            best_node_id = child_id
    
    return best_node_id or parent_node.children[0]

@tool("get_node_depth")
def get_node_depth(nodes: Dict[str, Any], node_id: str) -> int:
    """
    Calculate the depth of a node in the tree.
    
    Args:
        nodes: Dictionary of nodes
        node_id: ID of the node
        
    Returns:
        The depth of the node (0 for root)
    """
    depth = 0
    current_id = node_id
    
    while nodes[current_id].parent is not None:
        depth += 1
        current_id = nodes[current_id].parent
    
    return depth

# ====================
# Main Functions
# ====================

async def select_node(
    nodes: Dict[str, Node],
    root_id: str,
    current_node_id: str,
    max_iterations: int,
    current_iteration: int,
    exploration_constant: float,
    max_depth: int
) -> Node:
    """
    Selects a node using the UCB1 algorithm for the MCTS tree traversal.
    """
    try:
        # Use the special MCTS agent with tools for better node selection
        messages = [
            Message(
                role="system", 
                content=f"""
                Help select the best node for exploration in a Monte Carlo Tree Search.
                
                Current state:
                - Root node: {root_id}
                - Current node: {current_node_id} 
                - Iteration: {current_iteration}/{max_iterations}
                - Exploration constant: {exploration_constant}
                - Max depth: {max_depth}
                
                You have access to tools that can help calculate UCB1 values and find the node with the highest UCB1.
                """
            ),
            Message(
                role="user", 
                content=f"Here are the available nodes: {json.dumps({k: v.dict() for k, v in nodes.items()}, indent=2)}"
            )
        ]
        
        response: RunResponse = await mcts_agent.arun(
            messages=messages,
            tools=[calculate_ucb, find_node_with_highest_ucb, get_node_depth],
            response_model=NodeSelectionResponse
        )
        
        selected_node_id = response.content.selected_node_id
        
        if selected_node_id not in nodes:
            raise ValueError(f"Selected node {selected_node_id} not found in nodes")
            
        return nodes[selected_node_id]
        
    except Exception as e:
        print(f"Error in select_node: {e}")
        # Fallback to a simpler algorithm
        try:
            # Use random selection with bias toward unexplored nodes
            current_node = nodes[current_node_id]
            
            # If the node has children, select the one with the highest UCB value
            if current_node.children:
                child_nodes = [nodes[child_id] for child_id in current_node.children]
                unexplored = [n for n in child_nodes if n.visits == 0]
                
                if unexplored:
                    return random.choice(unexplored)
                
                # Calculate UCB values manually
                best_node = max(
                    child_nodes, 
                    key=lambda n: (n.value/n.visits if n.visits > 0 else float('inf')) + 
                         exploration_constant * (2 * current_node.visits / n.visits if n.visits > 0 else float('inf'))**0.5
                )
                return best_node
            
            # If no children, return the current node
            return current_node
        except Exception as fallback_error:
            print(f"Fallback selection failed: {fallback_error}")
            # Final fallback - just return a random node
            return nodes[random.choice(list(nodes.keys()))]

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