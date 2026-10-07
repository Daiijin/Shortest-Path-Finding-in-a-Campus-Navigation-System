"""Small backend-facing wrapper: one function, one output schema."""

from __future__ import annotations

from astar import astar
from dijkstra import dijkstra
from graph_loader import load_graph

_GRAPH, _COORDINATES, _NAMES = load_graph()


def get_nodes() -> list[dict]:
    """GUI metadata from the same graph used by both algorithms.

    The current CSV has no type column. Its intermediate nodes are named
    'Routing Node NN'; these stay in the graph but are not selectable places.
    IDs are kept even when two locations share the same display name.
    """
    return [
        {
            "id": node_id,
            "name": _NAMES[node_id],
            "lat": _COORDINATES[node_id][0],
            "lon": _COORDINATES[node_id][1],
            "type": "waypoint" if _NAMES[node_id].startswith("Routing Node ") else "location",
        }
        for node_id in _GRAPH
    ]


def get_edges() -> list[dict]:
    """One record per undirected road, retaining its supplied metre weight."""
    return [
        {"from": start, "to": goal, "distance": distance}
        for start, neighbors in _GRAPH.items()
        for goal, distance in neighbors
        if start < goal
    ]


def find_route(start: str, goal: str, algorithm: str = "astar") -> dict:
    algorithm_key = algorithm.strip().lower()

    if algorithm_key in {"astar", "a*", "a-star"}:
        result = astar(_GRAPH, _COORDINATES, start, goal)
    elif algorithm_key in {"dijkstra", "dijstra", "dijktra"}:
        result = dijkstra(_GRAPH, start, goal)
    else:
        raise ValueError("algorithm must be 'astar' or 'dijkstra'")

    # Add readable names without changing the four required metrics.
    result["path_names"] = [_NAMES.get(node, node) for node in result["path"]]
    return result


if __name__ == "__main__":
    import json

    start = input("Start node (e.g. N001): ").strip()
    goal = input("Goal node (e.g. N017): ").strip()
    algorithm = input("Algorithm [astar/dijkstra]: ").strip() or "astar"
    print(json.dumps(find_route(start, goal, algorithm), ensure_ascii=False, indent=2))
