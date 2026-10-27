"""Small backend-facing wrapper: one function, one output schema."""

from __future__ import annotations

from astar import astar
from dijkstra import dijkstra
from graph_loader import load_dataset, build_graph

_NODES, _EDGES = load_dataset()
_GRAPH = build_graph(_NODES, _EDGES)
_COORDINATES = {node["id"]: (node["lat"], node["lon"]) for node in _NODES}
_NAMES = {node["id"]: node["displayName"] for node in _NODES}
_EDGE_BY_PAIR = {frozenset((edge["from"], edge["to"])): edge for edge in _EDGES if edge["enabled"]}


def get_nodes() -> list[dict]:
    """Retain type, displayName, showOnMap and isTurn from the CSV."""
    return [dict(node) for node in _NODES]


def get_edges(include_disabled: bool = False) -> list[dict]:
    """Keep edge IDs/review metadata; closed edges are excluded by default."""
    return [dict(edge) for edge in _EDGES if include_disabled or edge["enabled"]]


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
    result["path_edges"] = [dict(_EDGE_BY_PAIR[frozenset((a, b))]) for a, b in zip(result["path"], result["path"][1:])]
    result["review_edges"] = [dict(edge) for edge in result["path_edges"] if edge["needsReview"]]
    result["needsReview"] = bool(result["review_edges"])
    return result


if __name__ == "__main__":
    import json

    start = input("Start node (e.g. N001): ").strip()
    goal = input("Goal node (e.g. N017): ").strip()
    algorithm = input("Algorithm [astar/dijkstra]: ").strip() or "astar"
    print(json.dumps(find_route(start, goal, algorithm), ensure_ascii=False, indent=2))
