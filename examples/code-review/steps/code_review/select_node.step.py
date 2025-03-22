from typing import Dict, Optional, Any
import math
import datetime
import json
from steps.shared.models import Node

config = {
    'type': 'event',
    'name': 'SelectNode',
    'description': 'Selects a node in the MCTS tree using UCB1 formula',
    'subscribes': ['mcts.iteration.started'],
    'emits': ['mcts.node.selected', 'code-review.reasoning.completed', 'review.error'],
    'flows': ['code-review-flow']
}

def convert_to_json_serializable(obj):
    """Convert SimpleNamespace or other non-serializable objects to dictionaries"""
    if obj is None:
        return None
    elif isinstance(obj, dict):
        return {k: convert_to_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_json_serializable(item) for item in obj]
    elif hasattr(obj, '__dict__'):
        # Handle SimpleNamespace or any class instance
        return convert_to_json_serializable(vars(obj))
    elif hasattr(obj, 'model_dump'):
        # Handle Pydantic models
        return convert_to_json_serializable(obj.model_dump())
    else:
        # Handle basic types
        try:
            # Test if it's JSON serializable
            json.dumps(obj)
            return obj
        except (TypeError, OverflowError):
            # If not serializable, convert to string
            return str(obj)

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
    if current_node_id not in nodes:
        raise ValueError(f"Node with ID {current_node_id} not found in nodes dictionary")
        
    current_node = nodes[current_node_id]
    
    # Handle node based on dictionary or object access
    if isinstance(current_node, dict):
        # Dictionary-based access
        children = current_node.get('children', [])
        visits = current_node.get('visits', 0)
    else:
        # Object-based access
        children = getattr(current_node, 'children', [])
        visits = getattr(current_node, 'visits', 0)
    
    # If we reached a leaf node or maximum depth, return it
    if not children or depth >= max_depth:
        return current_node
    
    # Check if there are any unexplored children
    for child_id in children:
        if child_id not in nodes:
            continue
        
        child_node = nodes[child_id]
        child_visits = child_node.get('visits', 0) if isinstance(child_node, dict) else getattr(child_node, 'visits', 0)
        
        if child_visits == 0:
            # Always choose unexplored nodes first
            return nodes[child_id]
    
    # If all children have been explored, calculate UCB1 for each child
    best_score = float('-inf')
    best_node_id = ''
    
    for child_id in children:
        if child_id not in nodes:
            continue
            
        child = nodes[child_id]
        
        # Handle object or dict access
        if isinstance(child, dict):
            child_visits = child.get('visits', 0)
            child_value = child.get('value', 0)
        else:
            child_visits = getattr(child, 'visits', 0)
            child_value = getattr(child, 'value', 0)
        
        # Ensure child_visits is at least 1 to avoid division by zero
        if child_visits < 1:
            child_visits = 1
            
        # UCB1 formula components
        exploitation = child_value / child_visits
        
        # Ensure current_node visits is at least 1
        current_visits = max(visits, 1)
        
        exploration = exploration_constant * math.sqrt(
            math.log(current_visits) / child_visits
        )
        score = exploitation + exploration
        
        if score > best_score:
            best_score = score
            best_node_id = child_id
    
    # If we found a best child, continue traversing
    if best_node_id and best_node_id in nodes:
        # Recursively select from the best child node
        return await select_node_ucb1(nodes, root_id, best_node_id, exploration_constant, max_depth, depth + 1)
    
    # Fallback to current node if no children are available
    return current_node

async def handler(input_data: Any, ctx):
    """Handler for the SelectNode step"""
    try:
        # Log incoming data type and format
        ctx.logger.info('SelectNode received input', {
            'input_type': type(input_data).__name__,
            'is_dict': isinstance(input_data, dict)
        })
        
        # Handle different input formats (dict, SimpleNamespace, etc.)
        if not isinstance(input_data, dict):
            # Convert to dictionary if it's not already
            try:
                # Try to convert SimpleNamespace to dict
                input_dict = vars(input_data)
                ctx.logger.info('Converted input to dictionary', {
                    'keys_count': len(input_dict.keys()) if hasattr(input_dict, 'keys') else 'No keys method',
                    'has_nodes': 'nodes' in input_dict
                })
            except Exception as e:
                # If conversion fails, log error and emit error report
                ctx.logger.error(f'Invalid input format for select_node: {str(e)}')
                await generate_error_report(ctx, {'error': str(e)})
                return
        else:
            input_dict = input_data
            ctx.logger.info('Using input dictionary', {
                'keys_count': len(input_dict.keys()) if hasattr(input_dict, 'keys') else 'No keys method',
                'has_nodes': 'nodes' in input_dict
            })
            
        # Extract required fields with fallbacks - ensure nodes is always a dict
        nodes = {}
        if 'nodes' in input_dict:
            raw_nodes = input_dict.get('nodes')
            # Convert nodes to a dictionary if it's not already
            if isinstance(raw_nodes, dict):
                nodes = raw_nodes
            elif hasattr(raw_nodes, '__dict__'):
                nodes = vars(raw_nodes)
            else:
                ctx.logger.error(f'Nodes is not a dictionary or object with __dict__: {type(raw_nodes)}')
                nodes = {}
        
        # Get other parameters
        root_id = input_dict.get('root_id', None)
        current_node_id = input_dict.get('current_node_id', root_id)
        max_iterations = input_dict.get('max_iterations', 100)
        current_iteration = input_dict.get('current_iteration', 0)
        exploration_constant = input_dict.get('exploration_constant', 1.414)
        max_depth = input_dict.get('max_depth', 10)
        
        # Additional values that might be needed
        output_url = input_dict.get('output_url', None)
        requirements = input_dict.get('requirements', 'No requirements specified')
        repository = input_dict.get('repository', 'Unknown repository')
        branch = input_dict.get('branch', 'Unknown branch')
        
        # Log extracted key values
        ctx.logger.info('Extracted parameters', {
            'nodes_count': len(nodes) if isinstance(nodes, dict) else 'Not a dict',
            'root_id': root_id,
            'current_node_id': current_node_id,
            'current_iteration': current_iteration,
            'max_iterations': max_iterations
        })
        
        # Basic validation
        if not nodes or not isinstance(nodes, dict) or len(nodes) == 0:
            ctx.logger.error('No valid nodes available for selection', {'nodes_type': type(nodes).__name__})
            await generate_error_report(ctx, {
                'error': f"Invalid nodes: {type(nodes).__name__}",
                'repository': repository,
                'branch': branch,
                'requirements': requirements,
                'output_url': output_url
            })
            return
            
        if not root_id:
            ctx.logger.error('Root ID not provided')
            await generate_error_report(ctx, input_dict)
            return
            
        if not current_node_id or current_node_id not in nodes:
            ctx.logger.error('Invalid current node ID', {
                'current_node_id': current_node_id, 
                'nodes_keys': list(nodes.keys())[:5] if hasattr(nodes, 'keys') else 'No keys method'
            })
            await generate_error_report(ctx, input_dict)
            return
            
        # Get the node to expand using UCB1 selection
        try:
            ctx.logger.info('Starting node selection with UCB1')
            selected_node = await select_node_ucb1(
                nodes,
                root_id,
                current_node_id,
                exploration_constant,
                max_depth
            )
            
            ctx.logger.info('Successfully selected node')
            
            # Continue with node selection only if we haven't reached maximum iterations
            if current_iteration >= max_iterations:
                ctx.logger.info('Maximum iterations reached, skipping to report generation')
                
                # Use ID property appropriately based on type
                if selected_node:
                    if isinstance(selected_node, dict):
                        selected_id = selected_node.get('id', current_node_id)
                    else:
                        selected_id = getattr(selected_node, 'id', current_node_id)
                else:
                    selected_id = current_node_id
                
                await generate_final_report(ctx, input_dict, selected_id)
                return
                
            # Get selected node ID based on object or dict
            if selected_node:
                if isinstance(selected_node, dict):
                    selected_id = selected_node.get('id', current_node_id)
                else:
                    selected_id = getattr(selected_node, 'id', current_node_id)
            else:
                selected_id = current_node_id
            
            ctx.logger.info('Emitting selected node event', {'selected_id': selected_id})
            
            # Convert nodes to JSON serializable format
            serializable_nodes = convert_to_json_serializable(nodes)
                
            # Emit the selected node with serializable data
            await ctx.emit({
                'topic': 'mcts.node.selected',
                'data': {
                    'nodes': serializable_nodes,
                    'root_id': root_id,
                    'current_node_id': selected_id,
                    'selected_node_id': selected_id,
                    'current_iteration': current_iteration,
                    'max_iterations': max_iterations,
                    'exploration_constant': exploration_constant,
                    'max_depth': max_depth,
                    'output_url': output_url,
                    'requirements': requirements,
                    'repository': repository,
                    'branch': branch
                }
            })
            
        except Exception as select_error:
            ctx.logger.error(f'Error in node selection: {str(select_error)}', {'error': str(select_error)})
            await generate_error_report(ctx, {
                'error': str(select_error),
                'repository': repository,
                'branch': branch,
                'requirements': requirements,
                'output_url': output_url
            })
            
    except Exception as error:
        ctx.logger.error(f'Error selecting node: {str(error)}', {'error': str(error)})
        await generate_error_report(ctx, {'error': str(error)})

async def generate_error_report(ctx, input_dict):
    """Generate a report when an error occurs"""
    # Create a basic report with error information
    try:
        # Extract available fields
        node_id = input_dict.get('root_id', 'error-node')
        state = "Error occurred during Monte Carlo Tree Search node selection."
        reasoning = "The code review process encountered an error during the selection phase of MCTS."
        
        # Generate more detailed error report
        if 'error' in input_dict:
            reasoning += f" Error: {input_dict['error']}"
        
        # Convert any non-serializable objects
        serializable_nodes = convert_to_json_serializable(input_dict.get('nodes', {}))
        
        report_data = {
            'selected_node_id': node_id,
            'state': state,
            'reasoning': reasoning,
            'stats': {
                'visits': 0,
                'value': 0,
                'total_visits': 0,
                'children_count': 0
            },
            'all_nodes': serializable_nodes,
            'output_url': input_dict.get('output_url', 'file://ERROR-REPORT.md'),
            'requirements': input_dict.get('requirements', 'No requirements specified'),
            'repository': input_dict.get('repository', 'Unknown repository'),
            'branch': input_dict.get('branch', 'Unknown branch')
        }
        
        # Log report data
        ctx.logger.info('Generating error report', {'report_type': 'error'})
        
        # Skip to report generation
        await ctx.emit({
            'topic': 'code-review.reasoning.completed',
            'data': report_data
        })
    except Exception as emit_error:
        ctx.logger.error('Failed to generate error report', {'error': str(emit_error)})
        try:
            # Emit a basic error for the error handler to catch
            await ctx.emit({
                'topic': 'review.error',
                'data': {
                    'message': f"Failed to generate error report: {str(emit_error)}",
                    'timestamp': datetime.datetime.now().isoformat(),
                    'repository': input_dict.get('repository', 'Unknown repository')
                }
            })
        except Exception:
            ctx.logger.error('Process ended while there are some promises outstanding')

async def generate_final_report(ctx, input_dict, selected_node_id):
    """Generate the final report after reaching max iterations"""
    try:
        # Get nodes and other relevant data
        nodes = input_dict.get('nodes', {})
        
        state = "No state available"
        
        if selected_node_id in nodes:
            selected_node = nodes[selected_node_id]
            if isinstance(selected_node, dict):
                state = selected_node.get('state', "No state available")
            else:
                state = getattr(selected_node, 'state', "No state available")
        else:
            state = "Selected node not found in node map."
        
        # Convert any non-serializable objects
        serializable_nodes = convert_to_json_serializable(nodes)
        
        # Prepare report data
        report_data = {
            'selected_node_id': selected_node_id,
            'state': state,
            'reasoning': f"MCTS completed after reaching maximum iterations. Selected final node {selected_node_id}",
            'stats': {
                'visits': 0,
                'value': 0,
                'total_visits': 0,
                'children_count': 0
            },
            'all_nodes': serializable_nodes,
            'output_url': input_dict.get('output_url', 'file://Review.md'),
            'requirements': input_dict.get('requirements', 'No requirements specified'),
            'repository': input_dict.get('repository', 'Unknown repository'),
            'branch': input_dict.get('branch', 'Unknown branch')
        }
        
        # Try to calculate stats if possible
        try:
            if selected_node_id in nodes:
                selected_node = nodes[selected_node_id]
                if isinstance(selected_node, dict):
                    visits = selected_node.get('visits', 0)
                    value = selected_node.get('value', 0)
                    children = selected_node.get('children', [])
                else:
                    visits = getattr(selected_node, 'visits', 0)
                    value = getattr(selected_node, 'value', 0)
                    children = getattr(selected_node, 'children', [])
                
                # Calculate total visits across all nodes
                total_visits = 0
                for node in nodes.values():
                    if isinstance(node, dict):
                        total_visits += node.get('visits', 0)
                    else:
                        total_visits += getattr(node, 'visits', 0)
                
                report_data['stats'] = {
                    'visits': visits,
                    'value': value,
                    'total_visits': total_visits,
                    'children_count': len(children)
                }
        except Exception as stats_error:
            ctx.logger.warn('Error calculating stats', {'error': str(stats_error)})
        
        # Log report data
        ctx.logger.info('Generating final report', {'report_type': 'final', 'selected_node_id': selected_node_id})
        
        # Emit event to generate the report
        await ctx.emit({
            'topic': 'code-review.reasoning.completed',
            'data': report_data
        })
    except Exception as report_error:
        ctx.logger.error('Failed to generate final report', {'error': str(report_error)})
        await generate_error_report(ctx, input_dict) 