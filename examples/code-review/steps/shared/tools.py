from typing import Dict, Any
from agno.tools import tool

# ====================
# Tool Definitions
# ====================

@tool("calculate_ucb")
def calculate_ucb(
    node_id: str, 
    visits: int, 
    value: float, 
    parent_visits: int, 
    exploration_constant: float
) -> float:
    """
    Calculate the UCB1 (Upper Confidence Bound) value for a node.
    
    Args:
        node_id: The ID of the node
        visits: Number of visits to this node
        value: Current value of this node
        parent_visits: Number of visits to the parent node
        exploration_constant: The exploration constant for UCB1
        
    Returns:
        The UCB1 value for the node
    """
    if visits == 0:
        return float('inf')  # Prioritize unexplored nodes
    
    exploitation = value / visits
    exploration = exploration_constant * (2 * parent_visits / visits) ** 0.5
    
    return exploitation + exploration

@tool("find_node_with_highest_ucb")
def find_node_with_highest_ucb(
    nodes: Dict[str, Any], 
    parent_id: str,
    exploration_constant: float
) -> str:
    """
    Find the child node with the highest UCB1 value.
    
    Args:
        nodes: Dictionary of nodes
        parent_id: ID of the parent node
        exploration_constant: The exploration constant for UCB1
        
    Returns:
        The ID of the node with highest UCB1 value
    """
    parent_node = nodes[parent_id]
    if not parent_node.children:
        return parent_id
    
    max_ucb = -float('inf')
    best_node_id = None
    
    for child_id in parent_node.children:
        child = nodes[child_id]
        ucb = calculate_ucb(
            child_id, 
            child.visits, 
            child.value, 
            parent_node.visits,
            exploration_constant
        )
        
        if ucb > max_ucb:
            max_ucb = ucb
            best_node_id = child_id
    
    return best_node_id or parent_node.children[0]

@tool("get_node_depth")
def get_node_depth(nodes: Dict[str, Any], node_id: str) -> int:
    """
    Calculate the depth of a node in the tree.
    
    Args:
        nodes: Dictionary of nodes
        node_id: ID of the node
        
    Returns:
        The depth of the node (0 for root)
    """
    depth = 0
    current_id = node_id
    
    while nodes[current_id].parent is not None:
        depth += 1
        current_id = nodes[current_id].parent
    
    return depth 