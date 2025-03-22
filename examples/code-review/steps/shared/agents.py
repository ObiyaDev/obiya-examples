from dotenv import load_dotenv
from agno.models.anthropic import Claude
from agno.models.openai import OpenAIChat
from agno.models.openrouter import OpenRouter
from unittest.mock import MagicMock, AsyncMock
import random
import os

# Load environment variables
load_dotenv()

if os.getenv("SPEND", "false").lower() == "true":
    from agno.agent import Agent
else:
    class Agent:
        def __init__(self, model, description, instructions, tools=None):
            self.model = model
            self.description = description
            self.instructions = instructions
            self.tools = tools or []
            self.mock_function = lambda *args, **kwargs: MagicMock(content="Mock response")
            self.mock_arun_function = AsyncMock(return_value=MagicMock(content="Mock async response"))

        def run(self, messages):
            return self.mock_function(messages)
        
        async def arun(self, prompt, use_structured_output=False, response_model=None, use_json_mode=False, **kwargs):
            """Mock asynchronous run method"""
            response = await self.mock_arun_function(prompt)
            
            # If a response model is provided, create an instance of it for the mock content
            if response_model:
                if hasattr(response_model, "__annotations__"):
                    # Create a simple instance with default values based on the model's fields
                    mock_data = {}
                    for field_name, field_type in response_model.__annotations__.items():
                        if field_type == str:
                            mock_data[field_name] = f"Mock {field_name}"
                        elif field_type == int:
                            mock_data[field_name] = random.randint(0, 100)
                        elif field_type == float:
                            mock_data[field_name] = random.uniform(0.0, 1.0)
                        elif field_type == bool:
                            mock_data[field_name] = random.choice([True, False])
                        elif hasattr(field_type, "__origin__") and field_type.__origin__ == list:
                            mock_data[field_name] = [f"Mock {field_name} {i}" for i in range(1, 4)]
                        else:
                            mock_data[field_name] = None
                    
                    # Handle NodeExpansion specifically to ensure we always have non-empty steps
                    if response_model.__name__ == 'NodeExpansion':
                        mock_data['reasoning'] = "Mock reasoning about code structure and potential improvements"
                        mock_data['steps'] = [
                            "Analyze code organization and maintainability",
                            "Review error handling and edge cases",
                            "Consider potential performance optimizations"
                        ]
                    
                    # Handle nested objects with special field types
                    if hasattr(response_model, 'issues') and 'issues' in mock_data:
                        if hasattr(response_model, 'Issue'):
                            issue_class = getattr(response_model, 'Issue')
                            mock_data['issues'] = [
                                {
                                    'claim': 'Mock issue claim',
                                    'grounds': 'Mock issue grounds',
                                    'warrant': 'Mock issue warrant',
                                    'backing': 'Mock issue backing',
                                    'qualifier': 'Mock issue qualifier'
                                }
                            ]
                    
                    response.content = response_model(**mock_data)
            elif use_json_mode or use_structured_output:
                # If JSON mode is requested but no model, return a simple JSON string
                if "reasoning" in prompt.lower() and "steps" in prompt.lower():
                    # Looks like a request for expansion steps
                    response.content = '{"reasoning": "Mock reasoning about code quality", "steps": ["Analyze code structure", "Review error handling", "Consider performance"]}'
                else:
                    response.content = '{"result": "Mock result", "status": "success"}'
                
            return response
        
        def set_mock_function(self, mock_function):
            self.mock_function = mock_function
            
        def set_mock_arun_function(self, mock_arun_function):
            self.mock_arun_function = mock_arun_function

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
    model=OpenRouter(id="google/gemini-2.0-flash-001"),
    description="Expert software reviewer using Toulmin model",
    instructions="""You are an expert software reviewer who uses the Toulmin Model of Argumentation.
    Given a set of commits, you'll evaluate code changes against specified requirements.
    Break down your analysis using the Toulmin Model:
    
    1. Claims: Assertions about the code's quality, functionality, or compliance
    2. Grounds: Evidence supporting those claims (specific code examples)
    3. Warrants: Reasoning connecting grounds to claims (software principles)
    4. Backing: Support for your warrants (industry standards, best practices)
    5. Qualifiers: Conditions under which claims may not hold
    
    IMPORTANT: Your response MUST be valid JSON with the requested structure. This is critical for proper processing.
    
    Thoroughly analyze code structure, architecture, potential bugs, security concerns,
    and alignment with specified requirements.
    """
)

# Analysis agent for system boundaries
system_analysis_agent = Agent(
    model=OpenRouter(id="google/gemini-2.0-flash-001"),
    description="Expert software architect",
    instructions="""You are an expert software architect who specializes in analyzing system boundaries.
    Given a set of code changes and commit messages, your task is to identify the strategy
    employed by the developer and determine the boundaries of the system being modified.
    
    IMPORTANT: If asked for JSON output, ensure your response is valid JSON with the requested structure.
    
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
    
    IMPORTANT: If asked for JSON output, ensure your response is valid JSON with the requested structure.
    
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
    instructions="""You are a general-purpose software engineering assistant.
    Your task is to respond to various software development and analysis queries.
    
    IMPORTANT: When asked for JSON responses, always ensure your response is valid, properly formatted JSON.
    
    Follow instructions carefully and provide detailed, accurate responses.
    """
) 