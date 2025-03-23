import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import importlib.util
import os
import sys
from pathlib import Path

# Add parent directory to path to import module
sys.path.append(str(Path(__file__).parent.parent))

# Get the correct path to the step file, accounting for the current directory
current_dir = os.path.dirname(os.path.abspath(__file__))
step_file_path = os.path.join(current_dir, 'select_node.step.py')

spec = importlib.util.spec_from_file_location(
    name="select_node",
    location=step_file_path
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

handler = module.handler
config = module.config
select_node_ucb1 = module.select_node_ucb1

from steps.shared.models import Node
from shared.tools import calculate_ucb

@pytest.fixture
def create_test_context():
    """Create a mocked context with logger and emit functions."""
    ctx = MagicMock()
    ctx.logger = MagicMock()
    ctx.logger.debug = MagicMock()
    ctx.logger.info = MagicMock()
    ctx.logger.error = MagicMock()
    ctx.emit = MagicMock()
    return ctx

@pytest.fixture
def create_mock_node_tree():
    """Create a mock node tree for MCTS testing"""
    return {
        'root': Node(
            id='root',
            parent=None,
            children=['child1', 'child2', 'child3'],
            visits=10,
            value=5,
            state='Initial state description',
            isTerminal=False
        ),
        'child1': Node(
            id='child1',
            parent='root',
            children=[],
            visits=5,
            value=3,
            state='Child 1 state description',
            isTerminal=False
        ),
        'child2': Node(
            id='child2',
            parent='root',
            children=[],
            visits=3,
            value=4,
            state='Child 2 state description',
            isTerminal=False
        ),
        'child3': Node(
            id='child3',
            parent='root',
            children=[],
            visits=2,
            value=1,
            state='Child 3 state description',
            isTerminal=False
        )
    }

@pytest.fixture
def create_sample_input(create_mock_node_tree):
    """Create sample input data for testing"""
    def _create_sample_input(node_id='root'):
        return {
            'nodes': create_mock_node_tree,
            'root_id': 'root',
            'current_node_id': node_id,
            'max_iterations': 100,
            'current_iteration': 1,
            'exploration_constant': 1.414,
            'max_depth': 10,
            'output_path': "file://Review.md",
            'requirements': "No requirements specified",
            'repository': "Unknown repository",
            'branch': "Unknown branch"
        }
    return _create_sample_input

@pytest.mark.asyncio
async def test_config():
    """Test that the step configuration is valid."""
    assert config['type'] == 'event'
    assert 'name' in config
    assert 'flows' in config
    assert 'subscribes' in config
    assert 'emits' in config
    assert 'mcts.iteration.started' in config['subscribes']
    assert 'mcts.node.selected' in config['emits']

@pytest.mark.asyncio
async def test_emit_selected_node(create_test_context, create_sample_input):
    """Test that the handler emits mcts.node.selected event with correct data"""
    # Arrange
    ctx = create_test_context
    input_data = create_sample_input()
    
    # Act
    await handler(input_data, ctx)
    
    # Assert
    ctx.emit.assert_called_once()
    emit_call = ctx.emit.call_args[0][0]
    assert emit_call['topic'] == 'mcts.node.selected'
    assert 'nodes' in emit_call['data']
    assert 'root_id' in emit_call['data']
    assert 'selected_node_id' in emit_call['data']
    assert 'max_iterations' in emit_call['data']
    assert 'current_iteration' in emit_call['data']
    assert 'exploration_constant' in emit_call['data']
    assert 'max_depth' in emit_call['data']
    
    ctx.logger.info.assert_called_with('Emitting selected node event', {'selected_id': emit_call['data']['selected_node_id']})

@pytest.mark.asyncio
async def test_handle_empty_nodes(create_test_context, create_sample_input):
    """Test handling of empty nodes"""
    # Arrange
    ctx = create_test_context
    input_data = create_sample_input()
    input_data['nodes'] = {}
    
    # Act
    await handler(input_data, ctx)
    
    # Assert
    ctx.logger.error.assert_called_with('No valid nodes available for selection', {'nodes_type': 'dict'})

@pytest.mark.asyncio
async def test_select_highest_ucb1(create_test_context, create_sample_input):
    """Test that the node with highest UCB1 value is selected"""
    # Arrange
    ctx = create_test_context
    input_data = create_sample_input()
    
    # Mock UCB1 calculation to always return higher value for child2
    with patch.object(module, 'calculate_ucb', side_effect=lambda node, parent, exploration_constant: 
                     2.0 if node['id'] == 'child2' else 1.0):
        
        # Act
        await handler(input_data, ctx)
        
        # Assert
        ctx.emit.assert_called_once()
        emit_call = ctx.emit.call_args[0][0]
        assert emit_call['data']['selected_node_id'] == 'child2'

@pytest.mark.asyncio
async def test_select_unexplored_node(create_test_context, create_sample_input):
    """Test that unexplored nodes are selected preferentially"""
    # Arrange
    ctx = create_test_context
    input_data = create_sample_input()
    
    # Add an unexplored node
    input_data['nodes']['child3'] = {
        "id": "child3",
        "parent": "root",
        "children": [],
        "visits": 0,  # No visits yet
        "value": 0,
        "state": "Unexplored reasoning path",
        "isTerminal": False
    }
    input_data['nodes']['root']['children'].append('child3')
    
    # Act
    await handler(input_data, ctx)
    
    # Assert
    ctx.emit.assert_called_once()
    emit_call = ctx.emit.call_args[0][0]
    assert emit_call['data']['selected_node_id'] == 'child3' 