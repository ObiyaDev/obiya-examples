"""Tests for the simulate step."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import os

import importlib.util
spec = importlib.util.spec_from_file_location(
    name="simulate",
    location="steps/code_review/simulate.step.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

handler = module.handler
config = module.config

from steps.shared.models import SimulationResult

# Determine if we should use mocks
should_mock = os.environ.get('MOCK_AGENTS', 'true').lower() == 'true'

@pytest.fixture
def ctx():
    """Create a mock context for testing."""
    context = MagicMock()
    context.emit = AsyncMock()
    context.logger = MagicMock()
    context.state = MagicMock()
    context.trace_id = "test-trace-id"
    return context

@pytest.fixture
def mock_node_tree():
    """Create a basic node tree for MCTS testing."""
    nodes = {
        'root': {
            'id': 'root',
            'parent': None,
            'children': ['expanded-1', 'expanded-2'],
            'visits': 5,
            'value': 3,
            'state': 'Root reasoning state',
            'isTerminal': False
        },
        'expanded-1': {
            'id': 'expanded-1',
            'parent': 'root',
            'children': [],
            'visits': 0,
            'value': 0,
            'state': 'First expanded reasoning state',
            'isTerminal': False
        },
        'expanded-2': {
            'id': 'expanded-2',
            'parent': 'root',
            'children': [],
            'visits': 0,
            'value': 0,
            'state': 'Second expanded reasoning state',
            'isTerminal': False
        }
    }
    return nodes

@pytest.fixture
def sample_input(mock_node_tree):
    """Create sample input data for testing."""
    return {
        'nodes': mock_node_tree,
        'rootId': 'root',
        'expandedNodeIds': ['expanded-1', 'expanded-2'],
        'maxIterations': 100,
        'currentIteration': 1,
        'explorationConstant': 1.414,
        'maxDepth': 10
    }

def test_config():
    """Test that the step configuration is correct."""
    assert config['type'] == 'event'
    assert config['name'] == 'Simulate'
    assert 'mcts.node.expanded' in config['subscribes']
    assert 'mcts.simulation.completed' in config['emits']
    assert 'code-review-flow' in config['flows']

# Tests that require agent mocking
if should_mock:
    @pytest.mark.asyncio
    @patch.object(module, 'evaluate_reasoning')
    async def test_call_evaluate_reasoning(mock_evaluate_reasoning, ctx, sample_input):
        """Test that the handler calls evaluate_reasoning with the correct parameters."""
        # Setup mock
        mock_result = SimulationResult(
            nodeId='expanded-1',
            value=0.8,
            explanation='Mock explanation for evaluation'
        )
        mock_evaluate_reasoning.return_value = mock_result
        
        # Call handler
        await handler(sample_input, ctx)
        
        # Assert
        mock_evaluate_reasoning.assert_called_with(
            sample_input['nodes'][sample_input['rootId']]['state'],
            [sample_input['nodes'][node_id]['state'] for node_id in sample_input['expandedNodeIds']],
            sample_input['expandedNodeIds']
        )

    @pytest.mark.asyncio
    @patch.object(module, 'evaluate_reasoning')
    async def test_emit_simulation_completed(mock_evaluate_reasoning, ctx, sample_input):
        """Test that the handler emits the simulation result."""
        # Setup mock
        mock_result = SimulationResult(
            nodeId='expanded-1',
            value=0.8,
            explanation='Mock explanation for evaluation'
        )
        mock_evaluate_reasoning.return_value = mock_result
        
        # Call handler
        await handler(sample_input, ctx)
        
        # Assert
        ctx.emit.assert_called_once()
        emit_call = ctx.emit.call_args[0][0]
        
        assert emit_call['topic'] == 'mcts.simulation.completed'
        assert emit_call['data']['nodes'] == sample_input['nodes']
        assert emit_call['data']['rootId'] == sample_input['rootId']
        assert emit_call['data']['simulationResult']['nodeId'] == 'expanded-1'
        assert emit_call['data']['simulationResult']['value'] == 0.8
        assert emit_call['data']['simulationResult']['explanation'] == 'Mock explanation for evaluation'
        assert emit_call['data']['maxIterations'] == sample_input['maxIterations']
        assert emit_call['data']['currentIteration'] == sample_input['currentIteration']
        assert emit_call['data']['explorationConstant'] == sample_input['explorationConstant']
        assert emit_call['data']['maxDepth'] == sample_input['maxDepth']

    @pytest.mark.asyncio
    @patch.object(module, 'evaluate_reasoning')
    async def test_handle_simulation_error(mock_evaluate_reasoning, ctx, sample_input):
        """Test that errors during simulation are handled properly."""
        # Setup mock to raise an exception
        mock_evaluate_reasoning.side_effect = Exception('Simulation failed')
        
        # Call handler
        await handler(sample_input, ctx)
        
        # Assert
        ctx.logger.error.assert_called_with('Error simulating node outcomes', {'error': 'Simulation failed'})
        ctx.emit.assert_not_called()
else:
    @pytest.mark.skip
    def test_skipping():
        """Warning about skipping tests that require agent mocking."""
        pytest.skip(
            "⚠️ Skipping simulate step tests that require agent mocking. "
            "Set MOCK_AGENTS=true to run these tests with mocked agent responses."
        )

@pytest.mark.asyncio
async def test_handle_empty_expanded_nodes(ctx, sample_input):
    """Test that the case when no expanded nodes are provided is handled."""
    # Modify input to have empty expanded nodes
    sample_input['expandedNodeIds'] = []
    
    # Call handler
    await handler(sample_input, ctx)
    
    # Assert
    ctx.logger.warn.assert_called_with('No expanded nodes to simulate', {'rootId': 'root'})
    ctx.emit.assert_not_called()

@pytest.mark.asyncio
async def test_handle_missing_nodes(ctx, sample_input):
    """Test that the case when a node is missing is handled."""
    # Modify input to have a non-existent node ID
    sample_input['expandedNodeIds'] = ['non-existent-node']
    
    # Call handler
    await handler(sample_input, ctx)
    
    # Assert
    ctx.logger.error.assert_called_with('Node not found in tree', {'nodeId': 'non-existent-node'})
    ctx.emit.assert_not_called()

@pytest.mark.asyncio
async def test_handle_missing_root(ctx, sample_input):
    """Test that the case when the root node is missing is handled."""
    # Modify input to have a non-existent root ID
    sample_input['rootId'] = 'non-existent-root'
    
    # Call handler
    await handler(sample_input, ctx)
    
    # Assert
    ctx.logger.error.assert_called_with('Root node not found in tree', {'rootId': 'non-existent-root'})
    ctx.emit.assert_not_called() 