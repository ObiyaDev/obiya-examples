import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
import os

from steps.code_review.controller_step import handler, MCTSControllerInput, MCTSControllerState, ErrorData
from steps.shared.actions import Node, Evaluation, Issue

@pytest.fixture
def mock_context():
    context = MagicMock()
    context.logger = MagicMock()
    context.state = AsyncMock()
    context.emit = AsyncMock()
    context.trace_id = "test-trace-id"
    return context

@pytest.fixture
def sample_input():
    return MCTSControllerInput(
        prompt="Review this code",
        repo_dir="/path/to/repo",
        branch="main",
        max_iterations=100,
        exploration_constant=1.414,
        max_depth=10,
        requirements="Check code quality",
        output_url=None
    )

@pytest.fixture
def mock_evaluation():
    """Fixture for evaluation result."""
    return Evaluation(
        score=0.8,
        issues=[
            Issue(
                claim="Good code structure",
                grounds="Clear organization",
                warrant="Industry standard practices",
                backing="Best practices in software engineering",
                qualifier="Minor improvements needed"
            )
        ],
        summary="Code is well structured",
        issueSummary="Minor issues found"
    )

@pytest.fixture
def mock_commits():
    """Fixture for commits object."""
    commits = AsyncMock()
    commits.files = "file1.py\nfile2.py"
    commits.messages = "commit1\ncommit2"
    return commits

@pytest.mark.asyncio
async def test_controller_initialization(mock_context, sample_input, mock_evaluation, mock_commits):
    """Test successful initialization of the MCTS controller."""
    with patch('steps.code_review.controller_step.evaluate_commits') as mock_evaluate, \
         patch('steps.code_review.controller_step.Commits.create') as mock_create:

        # Setup mocks
        mock_create.return_value = mock_commits
        mock_evaluate.return_value = mock_evaluation

        # Execute handler
        await handler(sample_input, mock_context)

        # Verify state was stored
        mock_context.state.set.assert_called_once_with(
            mock_context.trace_id,
            'requirements',
            sample_input.requirements
        )

        # Verify commits were created with correct arguments
        mock_create.assert_called_once_with(
            mock_context.trace_id,
            mock_context.state,
            sample_input.model_dump()
        )

        # Verify evaluation was performed with correct arguments
        mock_evaluate.assert_called_once_with(mock_commits, sample_input.requirements)

        # Verify MCTS iteration started event was emitted
        assert mock_context.emit.call_count == 1
        emit_call = mock_context.emit.call_args[0][0]
        assert emit_call['topic'] == 'mcts.iteration.started'
        assert isinstance(emit_call['data'], dict)

@pytest.mark.asyncio
async def test_high_score_immediate_completion(mock_context, sample_input, mock_commits):
    """Test that high evaluation scores skip iterations."""
    with patch('steps.code_review.controller_step.evaluate_commits') as mock_evaluate, \
         patch('steps.code_review.controller_step.Commits.create') as mock_create:
        
        # Setup mock to return high score
        high_score_eval = Evaluation(
            score=0.95,
            issues=[],
            summary="Excellent code",
            issueSummary="No issues found"
        )
        mock_evaluate.return_value = high_score_eval
        mock_create.return_value = mock_commits

        # Execute handler
        await handler(sample_input, mock_context)

        # Verify completion event was emitted
        assert mock_context.emit.call_count == 1
        emit_call = mock_context.emit.call_args[0][0]
        assert emit_call['topic'] == 'mcts.iterations.completed'
        assert isinstance(emit_call['data'], dict)
        assert 'max_iterations' in emit_call['data']

@pytest.mark.asyncio
async def test_zero_iterations_immediate_completion(mock_context, sample_input, mock_commits):
    """Test that zero max_iterations skips the MCTS process."""
    # Modify input to have zero iterations
    input_zero_iter = sample_input.model_copy(update={'max_iterations': 0})

    with patch('steps.code_review.controller_step.evaluate_commits') as mock_evaluate, \
         patch('steps.code_review.controller_step.Commits.create') as mock_create:

        # Setup mocks with proper async behavior
        mock_create.return_value = mock_commits
        mock_evaluate.return_value = Evaluation(
            score=0.5,
            issues=[Issue(
                claim="Test claim",
                grounds="Test grounds",
                warrant="Test warrant",
                backing="Test backing",
                qualifier="Test qualifier"
            )],
            summary="Average code",
            issueSummary="Some issues found"
        )

        # Execute handler
        await handler(input_zero_iter, mock_context)

        # Verify completion event was emitted
        assert mock_context.emit.call_count == 1
        emit_call = mock_context.emit.call_args[0][0]
        assert emit_call['topic'] == 'mcts.iterations.completed'
        assert isinstance(emit_call['data'], dict)
        assert emit_call['data']['max_iterations'] == 0

@pytest.mark.asyncio
async def test_error_handling(mock_context, sample_input):
    """Test error handling and error event emission."""
    with patch('steps.code_review.controller_step.Commits.create') as mock_create:
        # Setup mock to raise an error
        mock_create.side_effect = Exception("Repository access failed")

        # Execute handler
        await handler(sample_input, mock_context)

        # Verify error event was emitted
        assert mock_context.emit.call_count == 1
        emit_call = mock_context.emit.call_args[0][0]
        assert emit_call['topic'] == 'review.error'
        
        # Verify error data structure
        error_data = emit_call['data']
        assert isinstance(error_data, dict)
        assert 'message' in error_data
        assert 'timestamp' in error_data
        assert 'repository' in error_data
        assert error_data['message'] == "Repository access failed"

@pytest.mark.asyncio
async def test_evaluation_error_handling(mock_context, sample_input, mock_commits):
    """Test error handling during commit evaluation."""
    with patch('steps.code_review.controller_step.evaluate_commits') as mock_evaluate, \
         patch('steps.code_review.controller_step.Commits.create') as mock_create:

        # Setup mocks
        mock_create.return_value = mock_commits
        mock_evaluate.side_effect = Exception("Evaluation failed")

        # Execute handler
        await handler(sample_input, mock_context)

        # Verify error event was emitted
        assert mock_context.emit.call_count == 1
        emit_call = mock_context.emit.call_args[0][0]
        assert emit_call['topic'] == 'review.error'
        assert emit_call['data']['message'] == 'Evaluation failed'

@pytest.mark.asyncio
async def test_state_initialization(mock_context, sample_input, mock_evaluation, mock_commits):
    """Test proper initialization of MCTS state."""
    with patch('steps.code_review.controller_step.Commits.create') as mock_create, \
         patch('steps.code_review.controller_step.evaluate_commits') as mock_evaluate:

        mock_create.return_value = mock_commits
        mock_evaluate.return_value = mock_evaluation

        # Execute handler
        await handler(sample_input, mock_context)

        # Verify emitted state
        assert mock_context.emit.call_count == 1
        emit_call = mock_context.emit.call_args[0][0]
        state_data = emit_call['data']

        # Check state structure
        assert isinstance(state_data, dict)
        assert state_data['max_iterations'] == sample_input.max_iterations
        assert state_data['exploration_constant'] == sample_input.exploration_constant
        assert state_data['max_depth'] == sample_input.max_depth
        assert state_data['output_url'] == sample_input.output_url
        
        # Check root node
        root_id = state_data['root_id']
        nodes = state_data['nodes']
        assert root_id in nodes
        assert nodes[root_id]['parent'] is None
        assert nodes[root_id]['visits'] == 1
        assert nodes[root_id]['state'] == mock_evaluation.summary

@pytest.mark.asyncio
async def test_input_validation(mock_context):
    """Test input validation for required fields."""
    # Create input missing required fields
    with pytest.raises(ValueError, match="Field required"):
        MCTSControllerInput(
            prompt="Review this code",
            branch="main"
            # Missing repo_dir and requirements
        )

    # Test empty strings
    with pytest.raises(ValueError, match="String should have at least 1 character"):
        MCTSControllerInput(
            prompt="Review this code",
            repo_dir="",  # Empty repo_dir should raise validation error
            branch="main",
            requirements="Check code quality"
        )

    with pytest.raises(ValueError, match="String should have at least 1 character"):
        MCTSControllerInput(
            prompt="Review this code",
            repo_dir="/path/to/repo",
            branch="main",
            requirements=""  # Empty requirements should raise validation error
        )

@pytest.mark.asyncio
async def test_logging_truncation(mock_context, sample_input, mock_evaluation):
    """Test that long requirements are properly truncated in logs."""
    # Create input with long requirements
    long_requirements = "A" * 100  # Long string
    input_with_long_req = sample_input.model_copy(update={'requirements': long_requirements})

    with patch('steps.code_review.controller_step.Commits.create') as mock_create, \
         patch('steps.code_review.controller_step.evaluate_commits') as mock_evaluate:
        
        # Setup mock commits with proper async behavior
        commits = AsyncMock()
        # Mock the properties as regular strings
        commits.files = "file1.py\nfile2.py"
        commits.messages = "commit1\ncommit2"
        
        mock_create.return_value = commits
        mock_evaluate.return_value = mock_evaluation

        # Execute handler
        await handler(input_with_long_req, mock_context)

        # Verify truncated logging
        first_log_call = mock_context.logger.info.call_args_list[0]
        logged_data = first_log_call[0][1]  # Get the logged data dictionary
        assert len(logged_data['requirements']) <= 23  # 20 chars + "..."
        
        # Verify emit was called
        assert mock_context.emit.call_count == 1
        emit_call = mock_context.emit.call_args[0][0]
        assert emit_call['topic'] == 'mcts.iteration.started'
        assert isinstance(emit_call['data'], dict) 

@pytest.mark.asyncio
async def test_commits_creation_logging(mock_context, sample_input, mock_evaluation):
    """Test that repository access and commit loading is properly logged."""
    with patch('steps.code_review.controller_step.Commits.create') as mock_create, \
         patch('steps.code_review.controller_step.evaluate_commits') as mock_evaluate:
        
        # Setup mock commits with proper async behavior
        commits = AsyncMock()
        commits.files = "file1.py\nfile2.py"
        commits.messages = "commit1\ncommit2"
        
        mock_create.return_value = commits
        mock_evaluate.return_value = mock_evaluation

        # Execute handler
        await handler(sample_input, mock_context)

        # Verify logging calls
        mock_context.logger.info.assert_any_call('Creating commits object for repository', {
            'repo_dir': sample_input.repo_dir,
            'branch': sample_input.branch,
            'review_start_commit': sample_input.review_start_commit,
            'review_end_commit': sample_input.review_end_commit
        })

        mock_context.logger.info.assert_any_call('Successfully accessed repository and loaded commits', {
            'files_changed': 2,  # len(files.split('\n'))
            'commit_messages': 2  # len(messages.split('\n'))
        })

@pytest.mark.llm
@pytest.mark.asyncio
async def test_real_llm_evaluation(mock_context, sample_input):
    """Test real LLM evaluation when SPEND environment variable is set."""
    if not os.environ.get('SPEND'):
        pytest.skip("Skipping test that requires real LLM responses")

    with patch('steps.code_review.controller_step.Commits.create') as mock_create:
        # Setup mock commits with real data
        commits = AsyncMock()
        commits.files = "app.py\nutils.py"
        commits.messages = "Initial commit\nAdd utility functions"
        commits.diff = "diff --git a/app.py b/app.py\n+print('hello')"
        
        mock_create.return_value = commits

        # Execute handler with real LLM evaluation
        await handler(sample_input, mock_context)

        # Verify state was stored
        mock_context.state.set.assert_called_once_with(
            mock_context.trace_id,
            'requirements',
            sample_input.requirements
        )

        # Verify event was emitted
        assert mock_context.emit.call_count == 1
        emit_call = mock_context.emit.call_args[0][0]
        assert emit_call['topic'] == 'mcts.iteration.started'
        assert isinstance(emit_call['data'], dict)
        assert 'nodes' in emit_call['data']
        assert 'root_id' in emit_call['data'] 