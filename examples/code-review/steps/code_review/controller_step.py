from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
import os
import json
from steps.shared.actions import evaluate_commits, Commits, Node, Evaluation

class MCTSControllerInput(BaseModel):
    prompt: str = Field(..., description="The prompt for code review", min_length=1)
    repo_dir: str = Field(..., description="Directory of the repository to review", min_length=1)
    branch: str = Field(..., description="Branch to review", min_length=1)
    max_iterations: int = Field(default=100, description="Maximum number of MCTS iterations")
    exploration_constant: float = Field(default=1.414, description="Exploration constant for UCB1")
    max_depth: int = Field(default=10, description="Maximum depth of the MCTS tree")
    review_start_commit: Optional[str] = Field(None, description="Starting commit for review")
    review_end_commit: Optional[str] = Field(None, description="Ending commit for review")
    requirements: str = Field(..., description="Requirements for the code review", min_length=1)
    output_url: Optional[str] = Field(None, description="URL to save the review output")

class MCTSControllerState(BaseModel):
    nodes: Dict[str, Node]
    root_id: str
    current_node_id: str
    current_iteration: int
    max_iterations: int
    exploration_constant: float
    max_depth: int
    output_url: Optional[str]

class ErrorData(BaseModel):
    message: str
    timestamp: str
    repository: str
    output_url: Optional[str]
    requirements: str

config = {
    'type': 'event',
    'name': 'MCTSController',
    'description': 'Controls the MCTS process for code review reasoning',
    'subscribes': ['review.requested', 'mcts.backpropagation.completed'],
    'emits': ['mcts.iteration.started', 'mcts.iterations.completed', 'review.error'],
    'flows': ['code-review-flow']
}

async def handler(req: MCTSControllerInput, context: Any):
    """Handle the MCTS controller step."""
    # Log input with truncated requirements
    truncated_requirements = (
        f"{req.requirements[:20]}..." 
        if len(req.requirements) > 20 
        else req.requirements
    )
    
    context.logger.info('Analyzing review context', {
        **req.model_dump(),
        'requirements': truncated_requirements,
        'repo_dir': req.repo_dir
    })

    # Store requirements in state for error handling
    await context.state.set(context.trace_id, 'requirements', req.requirements)
 
    try:
        context.logger.info('Creating commits object for repository', { 
            'repo_dir': req.repo_dir, 
            'branch': req.branch,
            'review_start_commit': req.review_start_commit,
            'review_end_commit': req.review_end_commit
        })
        
        commits = await Commits.create(context.trace_id, context.state, req.model_dump())
        
        context.logger.info('Successfully accessed repository and loaded commits', {
            'files_changed': len(commits.files.split('\n')),
            'commit_messages': len(commits.messages.split('\n'))
        })
        
        try:
            evaluation = await evaluate_commits(commits, req.requirements)
        except Exception as eval_error:
            context.logger.error(f"Error in evaluate_commits: {str(eval_error)}")
            raise Exception(f"Evaluation failed: {str(eval_error)}")

        # Define a unique root node ID
        root_id = f'root-{int(datetime.now().timestamp())}'

        # Initialize the MCTS tree structure
        nodes = {
            root_id: Node(
                id=root_id,
                parent=None,
                children=[],
                visits=1,
                value=0,
                state=evaluation.summary,
                isTerminal=False
            )
        }
    
        state = MCTSControllerState(
            nodes=nodes,
            root_id=root_id,
            current_node_id=root_id,
            current_iteration=0,
            max_iterations=req.max_iterations,
            exploration_constant=req.exploration_constant,
            max_depth=req.max_depth,
            output_url=req.output_url
        )

        # If max_iterations is 0 or evaluation score is high, complete immediately
        if req.max_iterations == 0 or evaluation.score >= 0.9:
            await context.emit({
                'topic': 'mcts.iterations.completed',
                'data': state.model_dump()
            })
            return

        # Start MCTS process
        await context.emit({
            'topic': 'mcts.iteration.started',
            'data': state.model_dump()
        })

    except Exception as error:
        context.logger.error(f"Error in MCTS controller: {str(error)}")
        await context.emit({
            'topic': 'review.error',
            'data': ErrorData(
                message=str(error),
                timestamp=datetime.now().isoformat(),
                repository=req.repo_dir,
                output_url=req.output_url,
                requirements=req.requirements
            ).model_dump()
        }) 