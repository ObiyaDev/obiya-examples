import pytest
import os
from uuid import uuid4
from steps.shared.actions import (
    Node, NodeExpansion, Issue, Evaluation, SimulationResult, Commits,
    select_node, expand_node, evaluate_commits, evaluate_reasoning
)

# Skip all tests if SPEND is not true
pytestmark = pytest.mark.skipif(
    os.environ.get('SPEND') != 'true',
    reason='Tests skipped unless SPEND=true'
)

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
    expansion = await expand_node("Current node state")
    assert isinstance(expansion, NodeExpansion)
    assert isinstance(expansion.reasoning, str)
    assert isinstance(expansion.steps, list)
    assert all(isinstance(step, str) for step in expansion.steps)

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

# Test Commits class
@pytest.mark.asyncio
async def test_commits_create_raises_not_implemented():
    with pytest.raises(NotImplementedError):
        await Commits.create(
            trace_id=str(uuid4()),
            state={},
            input_data={"repoUrl": "https://github.com/test/repo"}
        )

# Test type definitions
def test_node_type_definition(sample_nodes):
    node = sample_nodes["root"]
    assert isinstance(node.id, str)
    assert isinstance(node.children, list)
    assert isinstance(node.visits, int)
    assert isinstance(node.value, float)
    assert isinstance(node.state, (str, type(None)))
    assert isinstance(node.isTerminal, (bool, type(None)))

def test_node_expansion_type_definition():
    expansion = NodeExpansion(
        reasoning="Test reasoning",
        steps=["step1", "step2"]
    )
    assert isinstance(expansion.reasoning, str)
    assert isinstance(expansion.steps, list)
    assert all(isinstance(step, str) for step in expansion.steps)

def test_issue_type_definition():
    issue = Issue(
        claim="Test claim",
        grounds="Test grounds",
        warrant="Test warrant",
        backing="Test backing",
        qualifier="Test qualifier"
    )
    assert all(isinstance(getattr(issue, field), str) for field in ["claim", "grounds", "warrant", "backing", "qualifier"])

def test_evaluation_type_definition():
    evaluation = Evaluation(
        score=0.8,
        issues=[Issue(
            claim="Test claim",
            grounds="Test grounds",
            warrant="Test warrant",
            backing="Test backing",
            qualifier="Test qualifier"
        )],
        summary="Test summary",
        issueSummary="Test issue summary"
    )
    assert isinstance(evaluation.score, float)
    assert isinstance(evaluation.issues, list)
    assert isinstance(evaluation.summary, str)
    assert isinstance(evaluation.issueSummary, str)

def test_simulation_result_type_definition():
    result = SimulationResult(
        nodeId="test-node",
        value=0.8,
        explanation="Test explanation"
    )
    assert isinstance(result.nodeId, str)
    assert isinstance(result.value, float)
    assert isinstance(result.explanation, str) 