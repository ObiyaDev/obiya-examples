import pytest
import os
from unittest.mock import patch, AsyncMock, MagicMock
from steps.shared.actions import (
    select_node, expand_node, evaluate_commits, evaluate_reasoning,
    expansion_agent, fallback_agent
)
from steps.shared.models import (
    Node, NodeExpansion, Issue, Evaluation, SimulationResult
)
from steps.shared.repositories import Commits

# Remove the skip marker to enable these tests to run
# pytestmark = pytest.mark.skipif(
#     os.environ.get('SPEND') != 'true',
#     reason='Tests skipped unless SPEND=true'
# )

# Test data fixtures
@pytest.fixture
def sample_nodes() -> dict[str, Node]:
    root_id = "root"
    child1_id = "child1"
    child2_id = "child2"
    
    return {
        root_id: Node(
            id=root_id,
            parent=None,
            children=[child1_id, child2_id],
            visits=10,
            value=5.0,
            state="Root state",
            isTerminal=False
        ),
        child1_id: Node(
            id=child1_id,
            parent=root_id,
            children=[],
            visits=5,
            value=2.5,
            state="Child 1 state",
            isTerminal=False
        ),
        child2_id: Node(
            id=child2_id,
            parent=root_id,
            children=[],
            visits=4,
            value=3.0,
            state="Child 2 state",
            isTerminal=False
        )
    }

@pytest.fixture
def sample_commits() -> Commits:
    return Commits(
        repo_dir="/tmp",
        files="file1.py\nfile2.py",
        messages="commit1: Initial commit\ncommit2: Update functionality",
        diff="diff --git a/file1.py b/file1.py\n..."
    )

# Test select_node
@pytest.mark.asyncio
async def test_select_node(sample_nodes):
    selected_node = await select_node(
        nodes=sample_nodes,
        root_id="root",
        current_node_id="root",
        max_iterations=100,
        current_iteration=0,
        exploration_constant=1.4,
        max_depth=5
    )
    assert isinstance(selected_node, Node)
    assert selected_node.id in sample_nodes

# Test expand_node
@pytest.mark.asyncio
async def test_expand_node():
    # Create a mock response with valid NodeExpansion
    mock_expansion = NodeExpansion(
        reasoning="Test reasoning process",
        steps=["Step 1", "Step 2", "Step 3"]
    )
    
    # Create a mock response object for the agent
    mock_response = MagicMock()
    mock_response.content = mock_expansion
    
    # Mock the expansion_agent.arun method
    with patch.object(expansion_agent, 'arun', new_callable=AsyncMock) as mock_arun:
        mock_arun.return_value = mock_response
        
        # Call the function
        expansion = await expand_node("Current node state")
        
        # Verify the result
        assert isinstance(expansion, NodeExpansion)
        assert expansion.reasoning == "Test reasoning process"
        assert len(expansion.steps) == 3
        assert expansion.steps[0] == "Step 1"

# Test evaluate_commits
@pytest.mark.asyncio
async def test_evaluate_commits(sample_commits):
    evaluation = await evaluate_commits(
        commits=sample_commits,
        requirements="Improve code quality"
    )
    assert isinstance(evaluation, Evaluation)
    assert 0 <= evaluation.score <= 1
    assert isinstance(evaluation.issues, list)
    assert all(isinstance(issue, Issue) for issue in evaluation.issues)
    assert isinstance(evaluation.summary, str)
    assert isinstance(evaluation.issueSummary, str)

# Test evaluate_reasoning
@pytest.mark.asyncio
async def test_evaluate_reasoning_empty_states():
    with pytest.raises(ValueError, match="No expanded states to evaluate"):
        await evaluate_reasoning(
            parent_state="Parent state",
            expanded_states=[]
        )

@pytest.mark.asyncio
async def test_evaluate_reasoning():
    result = await evaluate_reasoning(
        parent_state="Parent state",
        expanded_states=["State 1", "State 2"],
        expanded_node_ids=["node1", "node2"]
    )
    assert isinstance(result, SimulationResult)
    assert isinstance(result.nodeId, str)
    assert 0 <= result.value <= 1
    assert isinstance(result.explanation, str) 