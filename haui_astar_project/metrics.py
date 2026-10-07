"""Shared result/metric helpers for Dijkstra and A*."""

from __future__ import annotations

from dataclasses import dataclass, asdict
from time import perf_counter
from typing import Iterable, Optional


@dataclass
class SearchResult:
    algorithm: str
    start: str
    goal: str
    path: list[str]
    distance: Optional[float]
    visited_nodes: int
    execution_time: float  # seconds

    def to_dict(self) -> dict:
        """Backend-friendly standardized output."""
        data = asdict(self)
        data["distance"] = None if self.distance is None else round(self.distance, 3)
        data["execution_time"] = round(self.execution_time, 9)
        return data


def reconstruct_path(came_from: dict[str, str], start: str, goal: str) -> list[str]:
    """Reconstruct start -> goal path. Return [] when goal is unreachable."""
    if start == goal:
        return [start]
    if goal not in came_from:
        return []

    path = [goal]
    current = goal
    while current != start:
        current = came_from.get(current)
        if current is None:
            return []
        path.append(current)
    path.reverse()
    return path


def start_timer() -> float:
    return perf_counter()


def elapsed_seconds(start_time: float) -> float:
    return perf_counter() - start_time
