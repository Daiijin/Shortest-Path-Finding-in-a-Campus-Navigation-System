"""A* shortest-path algorithm for the HaUI campus graph."""

from __future__ import annotations

import heapq
from math import inf
from typing import Callable, Mapping, Sequence

from heuristic import euclidean_heuristic
from metrics import SearchResult, elapsed_seconds, reconstruct_path, start_timer

Graph = Mapping[str, Sequence[tuple[str, float]]]
Coordinates = Mapping[str, tuple[float, float]]


def astar(graph: Graph, coordinates: Coordinates, start: str, goal: str) -> dict:
    """Find the shortest path with A* and return standardized backend data."""
    if start not in graph:
        raise ValueError(f"Start node does not exist: {start}")
    if goal not in graph:
        raise ValueError(f"Goal node does not exist: {goal}")

    t0 = start_timer()

    g_score = {node: inf for node in graph}
    g_score[start] = 0.0

    came_from: dict[str, str] = {}
    closed_set: set[str] = set()

    # Heap items: (f_score, g_score_when_pushed, node)
    open_heap: list[tuple[float, float, str]] = []
    h_start = euclidean_heuristic(start, goal, coordinates)
    heapq.heappush(open_heap, (h_start, 0.0, start))

    visited_nodes = 0

    while open_heap:
        current_f, pushed_g, current = heapq.heappop(open_heap)

        # Ignore outdated heap entries and already finalized nodes.
        if pushed_g != g_score[current] or current in closed_set:
            continue

        visited_nodes += 1

        if current == goal:
            path = reconstruct_path(came_from, start, goal)
            return SearchResult(
                algorithm="A*",
                start=start,
                goal=goal,
                path=path,
                distance=g_score[goal],
                visited_nodes=visited_nodes,
                execution_time=elapsed_seconds(t0),
            ).to_dict()

        closed_set.add(current)

        for neighbor, edge_cost in graph[current]:
            if neighbor in closed_set:
                continue

            tentative_g = g_score[current] + edge_cost
            if tentative_g < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                h = euclidean_heuristic(neighbor, goal, coordinates)
                f_score = tentative_g + h
                heapq.heappush(open_heap, (f_score, tentative_g, neighbor))

    return SearchResult(
        algorithm="A*",
        start=start,
        goal=goal,
        path=[],
        distance=None,
        visited_nodes=visited_nodes,
        execution_time=elapsed_seconds(t0),
    ).to_dict()
