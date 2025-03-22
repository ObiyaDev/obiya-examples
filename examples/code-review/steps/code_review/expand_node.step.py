import uuid
from typing import Dict, Any, List

from steps.shared.models import Node
from steps.shared.actions import expand_node

config = {
    'type': 'event',
    'name': 'ExpandNode',
    'description': 'Expands a selected node by generating possible reasoning steps',
    'subscribes': ['mcts.node.selected'],
    'emits': ['mcts.node.expanded'],
    'flows': ['code-review-flow']
}

async def handler(input_data: Dict[str, Any], ctx):
    """
    Handler for expanding a selected node by generating possible reasoning steps.
    Uses LLM assistance to generate possible next steps in reasoning.
    """
    try:
        nodes = input_data.get('nodes', {})
        root_id = input_data.get('rootId')
        selected_node_id = input_data.get('selectedNodeId')
        
        # Validate the selected node exists
        if selected_node_id not in nodes:
            ctx.logger.error('Selected node not found in tree', {'nodeId': selected_node_id})
            return
        
        selected_node = nodes[selected_node_id]
        
        # Get the node's state to expand
        node_state = selected_node.get('state')
        if not node_state:
            ctx.logger.error('Selected node has no state to expand', {'nodeId': selected_node_id})
            return
        
        # Generate possible reasoning steps using expand_node from actions.py
        ctx.logger.info('Expanding node', {'nodeId': selected_node_id})
        expansion = await expand_node(node_state)
        
        # Check if we have any steps to add
        if not expansion.steps or len(expansion.steps) == 0:
            ctx.logger.warn('No expansion steps returned for node', {'nodeId': selected_node_id})
            return
        
        # Log expansion info
        ctx.logger.info('Generated expansion', {
            'nodeId': selected_node_id,
            'stepCount': len(expansion.steps),
            'reasoning': expansion.reasoning[:100] + ('...' if len(expansion.reasoning) > 100 else '')
        })
        
        # Create new nodes for each expanded step
        expanded_node_ids = []
        
        # Initialize or get existing children array
        if 'children' not in selected_node:
            selected_node['children'] = []
        
        # Create a child node for each expansion step
        for step in expansion.steps:
            new_node_id = str(uuid.uuid4())
            
            # Create the new node
            nodes[new_node_id] = {
                'id': new_node_id,
                'parent': selected_node_id,
                'children': [],
                'visits': 0,
                'value': 0,
                'state': step,
                'isTerminal': False
            }
            
            # Add the new node ID to the parent's children array
            selected_node['children'].append(new_node_id)
            
            # Add to our list of expanded nodes
            expanded_node_ids.append(new_node_id)
        
        # Emit the expanded tree to the next step
        await ctx.emit({
            'topic': 'mcts.node.expanded',
            'data': {
                'nodes': nodes,
                'expandedNodeIds': expanded_node_ids,
                'rootId': root_id,
                'maxIterations': input_data.get('maxIterations'),
                'currentIteration': input_data.get('currentIteration'),
                'explorationConstant': input_data.get('explorationConstant'),
                'maxDepth': input_data.get('maxDepth')
            }
        })
        
    except Exception as error:
        ctx.logger.error('Error expanding node', {'error': str(error)}) 