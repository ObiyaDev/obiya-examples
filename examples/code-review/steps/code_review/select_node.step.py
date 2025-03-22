from typing import Dict, Optional
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
    depth: int = 0
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

async def handler(input_data: dict, ctx):
    """Handler for the SelectNode step"""
    try:
        # Extract input data
        nodes = input_data['nodes']
        root_id = input_data['rootId']
        current_node_id = input_data['currentNodeId']
        max_iterations = input_data['maxIterations']
        current_iteration = input_data['currentIteration']
        exploration_constant = input_data['explorationConstant']
        max_depth = input_data['maxDepth']
        
        # Basic validation
        if not nodes:
            ctx.logger.error('No valid nodes available for selection')
            return
        
        # Select the best node according to UCB1 formula
        selected_node = await select_node_ucb1(
            nodes, root_id, current_node_id, exploration_constant, max_depth
        )
        
        ctx.logger.info('Node selected', {
            'selectedNodeId': selected_node.id,
            'currentIteration': current_iteration,
            'maxIterations': max_iterations
        })
        
        # Emit the selected node for the next step in MCTS
        await ctx.emit({
            'topic': 'mcts.node.selected',
            'data': {
                'nodes': nodes,
                'rootId': root_id,
                'selectedNodeId': selected_node.id,
                'maxIterations': max_iterations,
                'currentIteration': current_iteration,
                'explorationConstant': exploration_constant,
                'maxDepth': max_depth
            }
        })
    except Exception as error:
        ctx.logger.error('Error selecting node', {'error': str(error)}) 