from datetime import datetime
from typing import Dict, Optional, Any
from pydantic import BaseModel, Field
from steps.shared.actions import evaluate_commits, Commits, Node

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

async def handler(req: Any, context: Any):
    """Handle the MCTS controller step."""
    try:
        # Handle different input types (SimpleNamespace or Pydantic model)
        if hasattr(req, 'model_dump'):
            # It's a Pydantic model
            input_dict = req.model_dump()
            requirements = req.requirements
            repo_dir = req.repo_dir
            branch = req.branch
            review_start_commit = req.review_start_commit
            review_end_commit = req.review_end_commit
            max_iterations = req.max_iterations
            exploration_constant = req.exploration_constant
            max_depth = req.max_depth
            output_url = req.output_url
        else:
            # It's a SimpleNamespace object or dict
            input_dict = vars(req) if not isinstance(req, dict) else req
            requirements = input_dict.get('requirements')
            repo_dir = input_dict.get('repo_dir')
            branch = input_dict.get('branch')
            review_start_commit = input_dict.get('review_start_commit')
            review_end_commit = input_dict.get('review_end_commit')
            max_iterations = input_dict.get('max_iterations', 100)
            exploration_constant = input_dict.get('exploration_constant', 1.414)
            max_depth = input_dict.get('max_depth', 10)
            output_url = input_dict.get('output_url')
            
        # Validate required fields
        if not repo_dir:
            raise ValueError("repo_dir is required")
        if not branch:
            raise ValueError("branch is required")
        if not requirements:
            raise ValueError("requirements is required")
        
        # Log input with truncated requirements
        truncated_requirements = (
            f"{requirements[:20]}..." 
            if len(requirements) > 20 
            else requirements
        )
        
        context.logger.info('Analyzing review context', {
            'requirements': truncated_requirements,
            'repo_dir': repo_dir,
            'branch': branch,
            'max_iterations': max_iterations
        })

        # Store requirements in state for error handling
        await context.state.set(context.trace_id, 'requirements', requirements)
    
        context.logger.info('Creating commits object for repository', { 
            'repo_dir': repo_dir, 
            'branch': branch,
            'review_start_commit': review_start_commit,
            'review_end_commit': review_end_commit
        })
        
        commits = await Commits.create(context.trace_id, context.state, input_dict)
        
        context.logger.info('Successfully accessed repository and loaded commits', {
            'files_changed': len(commits.files.split('\n')),
            'commit_messages': len(commits.messages.split('\n'))
        })
        
        evaluation = await evaluate_commits(commits, requirements)
        
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
            max_iterations=max_iterations,
            exploration_constant=exploration_constant,
            max_depth=max_depth,
            output_url=output_url
        )

        # If max_iterations is 0 or evaluation score is high, complete immediately
        if max_iterations == 0 or evaluation.score >= 0.9:
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
        
        # Get info for error report
        error_data = ErrorData(
            message=str(error),
            timestamp=datetime.now().isoformat(),
            repository=getattr(req, 'repo_dir', str(req)),
            output_url=getattr(req, 'output_url', None),
            requirements=getattr(req, 'requirements', 'Unknown requirements')
        )
        
        await context.emit({
            'topic': 'review.error',
            'data': error_data.model_dump()
        }) 