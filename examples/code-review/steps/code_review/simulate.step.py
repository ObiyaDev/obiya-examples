from typing import Dict, Any, List

from steps.shared.models import SimulationResult
from steps.shared.actions import evaluate_reasoning

config = {
    'type': 'event',
    'name': 'Simulate',
    'description': 'Simulates reasoning path outcome using LLM evaluation',
    'subscribes': ['mcts.node.expanded'],
    'emits': ['mcts.simulation.completed'],
    'flows': ['code-review-flow']
}

async def handler(input_data: Dict[str, Any], ctx):
    """
    Handler for simulating node outcomes by evaluating reasoning paths.
    Uses LLM assistance to evaluate the quality of reasoning paths.
    """
    try:
        nodes = input_data.get('nodes', {})
        root_id = input_data.get('rootId')
        expanded_node_ids = input_data.get('expandedNodeIds', [])
        max_iterations = input_data.get('maxIterations')
        current_iteration = input_data.get('currentIteration')
        exploration_constant = input_data.get('explorationConstant')
        max_depth = input_data.get('maxDepth')
        
        # Validate the root node exists
        if root_id not in nodes:
            ctx.logger.error('Root node not found in tree', {'rootId': root_id})
            return
        
        # Validate there are expanded nodes to simulate
        if not expanded_node_ids or len(expanded_node_ids) == 0:
            ctx.logger.warn('No expanded nodes to simulate', {'rootId': root_id})
            return
        
        # Validate that all expanded nodes exist in the tree
        for node_id in expanded_node_ids:
            if node_id not in nodes:
                ctx.logger.error('Node not found in tree', {'nodeId': node_id})
                return
        
        # Get the root node state
        root_state = nodes[root_id].get('state')
        if not root_state:
            ctx.logger.error('Root node has no state for simulation context', {'rootId': root_id})
            return
        
        # Get the states of expanded nodes
        expanded_states = []
        for node_id in expanded_node_ids:
            state = nodes[node_id].get('state')
            if not state:
                ctx.logger.warn('Expanded node has no state', {'nodeId': node_id})
                continue
            expanded_states.append(state)
        
        if not expanded_states:
            ctx.logger.warn('No valid expanded states for simulation', {'rootId': root_id})
            return
        
        # Perform simulation by evaluating the reasoning paths
        ctx.logger.info('Simulating outcomes for expanded nodes', {
            'rootId': root_id,
            'expandedNodeCount': len(expanded_node_ids),
            'currentIteration': current_iteration,
            'maxIterations': max_iterations
        })
        
        # Use evaluate_reasoning from actions.py to evaluate reasoning paths
        simulation_result = await evaluate_reasoning(root_state, expanded_states, expanded_node_ids)
        
        ctx.logger.info('Simulation completed', {
            'selectedNodeId': simulation_result.nodeId,
            'value': simulation_result.value
        })
        
        # Emit the simulation result for backpropagation
        await ctx.emit({
            'topic': 'mcts.simulation.completed',
            'data': {
                'nodes': nodes,
                'rootId': root_id,
                'simulationResult': {
                    'nodeId': simulation_result.nodeId,
                    'value': simulation_result.value,
                    'explanation': simulation_result.explanation
                },
                'maxIterations': max_iterations,
                'currentIteration': current_iteration,
                'explorationConstant': exploration_constant,
                'maxDepth': max_depth
            }
        })
    except Exception as error:
        ctx.logger.error('Error simulating node outcomes', {'error': str(error)})