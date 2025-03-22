from typing import Dict, Optional, Any
import math
from steps.shared.models import Node

config = {
    'type': 'event',
    'name': 'SelectNode',
    'description': 'Selects a node in the MCTS tree using UCB1 formula',
    'subscribes': ['mcts.iteration.started'],
    'emits': ['mcts.node.selected'],
    'flows': ['code-review-flow']
}

async def select_node_ucb1(
    nodes: Dict[str, Node],
    root_id: str,
    current_node_id: str,
    exploration_constant: float,
    max_depth: int,
    depth: int = 0,
    output_url: str = None
) -> Node:
    """
    Selects a node using the UCB1 formula, which balances exploration and exploitation
    UCB1 = (node.value / node.visits) + explorationConstant * sqrt(ln(parentVisits) / node.visits)
    """
    # Starting from the current node
    current_node = nodes[current_node_id]
    
    # If we reached a leaf node or maximum depth, return it
    if not current_node.children or depth >= max_depth:
        return current_node
    
    # Check if there are any unexplored children
    for child_id in current_node.children:
        if nodes[child_id].visits == 0:
            # Always choose unexplored nodes first
            return nodes[child_id]
    
    # If all children have been explored, calculate UCB1 for each child
    best_score = float('-inf')
    best_node_id = ''
    
    for child_id in current_node.children:
        child = nodes[child_id]
        
        # UCB1 formula components
        exploitation = child.value / child.visits if child.visits > 0 else 0
        exploration = exploration_constant * math.sqrt(
            math.log(max(current_node.visits, 1)) / max(child.visits, 1)
        )
        score = exploitation + exploration
        
        if score > best_score:
            best_score = score
            best_node_id = child_id
    
    # If we found a best child, continue traversing
    if best_node_id:
        # Recursively select from the best child node
        return await select_node_ucb1(nodes, root_id, best_node_id, exploration_constant, max_depth, depth + 1)
    
    # Fallback to current node if no children are available
    return current_node

async def handler(input_data: Any, ctx):
    """Handler for the SelectNode step"""
    try:
        # Handle different input formats (dict, SimpleNamespace, etc.)
        if not isinstance(input_data, dict):
            # Convert to dictionary if it's not already
            try:
                # Try to convert SimpleNamespace to dict
                input_dict = vars(input_data)
            except:
                # If all else fails, log error and return
                ctx.logger.error('Invalid input format for select_node')
                return
        else:
            input_dict = input_data
            
        # Extract required fields with fallbacks
        nodes = input_dict.get('nodes', {})
        root_id = input_dict.get('root_id', None)
        current_node_id = input_dict.get('current_node_id', root_id)
        max_iterations = input_dict.get('max_iterations', 100)
        current_iteration = input_dict.get('current_iteration', 0)
        exploration_constant = input_dict.get('exploration_constant', 1.414)
        max_depth = input_dict.get('max_depth', 10)
        
        # Additional values that might be needed
        output_url = input_dict.get('output_url', None)
        
        # Basic validation
        if not nodes:
            ctx.logger.error('No valid nodes available for selection')
            return
            
        if not root_id:
            ctx.logger.error('Root ID not provided')
            return
            
        if not current_node_id:
            ctx.logger.error('Current node ID not provided')
            return
        
        # Select the best node according to UCB1 formula
        selected_node = await select_node_ucb1(
            nodes, root_id, current_node_id, exploration_constant, max_depth
        )
        
        ctx.logger.info('Node selected', {
            'selected_node_id': selected_node.id,
            'current_iteration': current_iteration,
            'max_iterations': max_iterations
        })
        
        # Emit the selected node for the next step in MCTS
        await ctx.emit({
            'topic': 'mcts.node.selected',
            'data': {
                'nodes': nodes,
                'root_id': root_id,
                'selected_node_id': selected_node.id,
                'max_iterations': max_iterations,
                'current_iteration': current_iteration,
                'exploration_constant': exploration_constant,
                'max_depth': max_depth,
                'output_url': output_url
            }
        })
    except Exception as error:
        ctx.logger.error('Error selecting node', {'error': str(error)}) 