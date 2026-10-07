"""Heuristic functions for A* on the HaUI campus graph."""

from __future__ import annotations

import math
from typing import Mapping, Tuple

Coordinate = Tuple[float, float]  # (latitude, longitude)

# Conservative campus-scale conversion. The edge weights in the supplied graph are metres.
# Using 110_500 m/degree keeps the straight-line estimate compatible with those weights.
METERS_PER_DEGREE = 110_500.0


def euclidean_heuristic(
    node: str,
    goal: str,
    coordinates: Mapping[str, Coordinate],
) -> float:
    """Return straight-line Euclidean distance from ``node`` to ``goal`` in metres.

    The assignment formula is:
        h(n) = sqrt((x_n - x_goal)^2 + (y_n - y_goal)^2)

    Because the project stores latitude/longitude instead of x/y metres, we first map the
    local coordinate differences to metres, then apply the same Euclidean formula.
    """
    if node not in coordinates:
        raise KeyError(f"Unknown node: {node}")
    if goal not in coordinates:
        raise KeyError(f"Unknown goal node: {goal}")

    lat_n, lon_n = coordinates[node]
    lat_g, lon_g = coordinates[goal]

    mean_lat_rad = math.radians((lat_n + lat_g) / 2.0)
    dx = (lon_n - lon_g) * METERS_PER_DEGREE * math.cos(mean_lat_rad)
    dy = (lat_n - lat_g) * METERS_PER_DEGREE

    return math.sqrt(dx * dx + dy * dy)
