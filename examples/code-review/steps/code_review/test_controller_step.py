import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

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
        repo_url="https://github.com/test/repo",
        repo_dir="/path/to/repo",
        branch="main",
        max_iterations=100,
        exploration_constant=1.414,
        max_depth=10,
        requirements="Check code quality",
        output_path="review.md"
    )

@pytest.fixture
def mock_evaluation():
    return Evaluation(
        score=0.8,
        issues=[
            Issue(
                claim="Good code structure",
                grounds="Clear organization",
                warrant="Industry standards",
                backing="Best practices",
                qualifier="Minor improvements needed"
            )
        ],
        summary="Code is well structured",
        issueSummary="Minor issues found"
    )

@pytest.mark.asyncio
async def test_controller_initialization(mock_context, sample_input, mock_evaluation):
    """Test successful initialization of the MCTS controller."""
    with patch('steps.shared.actions.Commits.create') as mock_create, \
         patch('steps.shared.actions.evaluate_commits') as mock_evaluate:

        # Setup mocks
        mock_commits = AsyncMock()
        mock_commits.files = "file1.py\nfile2.py"
        mock_commits.messages = "commit1\ncommit2"
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
        mock_context.emit.assert_called_once()
        emit_call = mock_context.emit.call_args[0][0]
        assert emit_call['topic'] == 'mcts.iteration.started'
        assert isinstance(emit_call['data'], dict)

@pytest.mark.asyncio
async def test_high_score_immediate_completion(mock_context, sample_input):
    """Test that high evaluation scores skip iterations."""
    with patch('steps.shared.actions.Commits.create') as mock_create, \
         patch('steps.shared.actions.evaluate_commits') as mock_evaluate:
        
        # Setup mock to return high score
        high_score_eval = Evaluation(
            score=0.95,
            issues=[],
            summary="Excellent code",
            issueSummary="No issues found"
        )
        mock_evaluate.return_value = high_score_eval

        # Execute handler
        await handler(sample_input, mock_context)

        # Verify completion event was emitted
        mock_context.emit.assert_called_once()
        emit_call = mock_context.emit.call_args[0][0]
        assert emit_call['topic'] == 'mcts.iterations.completed'

@pytest.mark.asyncio
async def test_zero_iterations_immediate_completion(mock_context, sample_input):
    """Test that zero max_iterations skips the MCTS process."""
    # Modify input to have zero iterations
    input_zero_iter = sample_input.model_copy(update={'max_iterations': 0})

    with patch('steps.shared.actions.Commits.create') as mock_create, \
         patch('steps.shared.actions.evaluate_commits') as mock_evaluate:
        
        mock_evaluate.return_value = Evaluation(
            score=0.5,
            issues=[],
            summary="Average code",
            issueSummary="Some issues found"
        )

        # Execute handler
        await handler(input_zero_iter, mock_context)

        # Verify completion event was emitted
        mock_context.emit.assert_called_once()
        emit_call = mock_context.emit.call_args[0][0]
        assert emit_call['topic'] == 'mcts.iterations.completed'

@pytest.mark.asyncio
async def test_error_handling(mock_context, sample_input):
    """Test error handling and error event emission."""
    with patch('steps.shared.actions.Commits.create') as mock_create:
        # Setup mock to raise an error
        mock_create.side_effect = Exception("Repository access failed")

        # Execute handler
        await handler(sample_input, mock_context)

        # Verify error event was emitted
        mock_context.emit.assert_called_once()
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
async def test_commits_creation_logging(mock_context, sample_input, mock_evaluation):
    """Test that repository access and commit loading is properly logged."""
    with patch('steps.shared.actions.Commits.create') as mock_create, \
         patch('steps.shared.actions.evaluate_commits') as mock_evaluate:
        
        # Setup mock commits
        mock_commits = AsyncMock()
        mock_commits.files = "file1.py\nfile2.py"
        mock_commits.messages = "commit1\ncommit2"
        mock_create.return_value = mock_commits
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

@pytest.mark.asyncio
async def test_evaluation_error_handling(mock_context, sample_input):
    """Test error handling during commit evaluation."""
    with patch('steps.shared.actions.Commits.create') as mock_create, \
         patch('steps.shared.actions.evaluate_commits') as mock_evaluate:
        
        # Setup mocks
        mock_commits = AsyncMock()
        mock_commits.files = "file1.py"
        mock_commits.messages = "commit1"
        mock_create.return_value = mock_commits
        
        # Make evaluate_commits raise an error
        mock_evaluate.side_effect = Exception("Evaluation failed")

        # Execute handler
        await handler(sample_input, mock_context)

        # Verify error event was emitted
        mock_context.emit.assert_called_once()
        emit_call = mock_context.emit.call_args[0][0]
        assert emit_call['topic'] == 'review.error'
        assert emit_call['data']['message'] == "Evaluation failed"

@pytest.mark.asyncio
async def test_state_initialization(mock_context, sample_input, mock_evaluation):
    """Test proper initialization of MCTS state."""
    with patch('steps.shared.actions.Commits.create') as mock_create, \
         patch('steps.shared.actions.evaluate_commits') as mock_evaluate:
        
        mock_create.return_value = AsyncMock()
        mock_evaluate.return_value = mock_evaluation

        # Execute handler
        await handler(sample_input, mock_context)

        # Verify emitted state
        emit_call = mock_context.emit.call_args[0][0]
        state_data = emit_call['data']
        
        # Check state structure
        assert isinstance(state_data, dict)
        assert state_data['max_iterations'] == sample_input.max_iterations
        assert state_data['exploration_constant'] == sample_input.exploration_constant
        assert state_data['max_depth'] == sample_input.max_depth
        
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

    with patch('steps.shared.actions.Commits.create') as mock_create, \
         patch('steps.shared.actions.evaluate_commits') as mock_evaluate:
        
        mock_create.return_value = AsyncMock()
        mock_evaluate.return_value = mock_evaluation

        # Execute handler
        await handler(input_with_long_req, mock_context)

        # Verify truncated logging
        first_log_call = mock_context.logger.info.call_args_list[0]
        logged_data = first_log_call[0][1]  # Get the logged data dictionary
        assert len(logged_data['requirements']) <= 23  # 20 chars + "..." 