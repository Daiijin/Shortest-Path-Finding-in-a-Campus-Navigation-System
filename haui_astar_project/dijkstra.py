"""Dijkstra shortest-path algorithm with the same output contract as A*."""

from __future__ import annotations

import heapq
from math import inf
from typing import Mapping, Sequence

from metrics import SearchResult, elapsed_seconds, reconstruct_path, start_timer

Graph = Mapping[str, Sequence[tuple[str, float]]]


def dijkstra(graph: Graph, start: str, goal: str) -> dict:
    if start not in graph:
        raise ValueError(f"Start node does not exist: {start}")
    if goal not in graph:
        raise ValueError(f"Goal node does not exist: {goal}")

    t0 = start_timer()
    distances = {node: inf for node in graph}
    distances[start] = 0.0
    came_from: dict[str, str] = {}
    closed_set: set[str] = set()
    priority_queue: list[tuple[float, str]] = [(0.0, start)]
    visited_nodes = 0

    while priority_queue:
        current_distance, current = heapq.heappop(priority_queue)

        if current_distance != distances[current] or current in closed_set:
            continue

        visited_nodes += 1
        if current == goal:
            path = reconstruct_path(came_from, start, goal)
            return SearchResult(
                algorithm="Dijkstra",
                start=start,
                goal=goal,
                path=path,
                distance=distances[goal],
                visited_nodes=visited_nodes,
                execution_time=elapsed_seconds(t0),
            ).to_dict()

        closed_set.add(current)

        for neighbor, edge_cost in graph[current]:
            if neighbor in closed_set:
                continue
            new_distance = current_distance + edge_cost
            if new_distance < distances[neighbor]:
                distances[neighbor] = new_distance
                came_from[neighbor] = current
                heapq.heappush(priority_queue, (new_distance, neighbor))

    return SearchResult(
        algorithm="Dijkstra",
        start=start,
        goal=goal,
        path=[],
        distance=None,
        visited_nodes=visited_nodes,
        execution_time=elapsed_seconds(t0),
    ).to_dict()
