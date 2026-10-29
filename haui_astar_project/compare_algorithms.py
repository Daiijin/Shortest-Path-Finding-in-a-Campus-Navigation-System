"""Compare A* and Dijkstra on the same start/destination pairs."""

from __future__ import annotations

import csv
import math
import statistics
from pathlib import Path

from astar import astar
from dijkstra import dijkstra
from graph_loader import load_graph

# Representative campus routes, including dormitory destinations.
TEST_PAIRS = [
    ("N001", "N007"),  # Main gate -> National Defense dormitory
    ("N001", "N017"),  # Main gate -> Lecturer dormitory 4
    ("N001", "N020"),  # Main gate -> Lecturer dormitory 1
    ("N027", "N017"),  # Library C18 -> Lecturer dormitory 4
    ("N033", "N020"),  # Side gate 1 -> Lecturer dormitory 1
    ("N045", "N007"),  # Side gate 2 -> National Defense dormitory
    ("N022", "N027"),  # C1 -> Library C18
    ("N026", "N001"),  # C16 -> Main gate
    ("N009", "N024"),  # Defense equipment -> C15
    ("N083", "N023"),  # Canteen -> C3
]


def average_time(run_func, repeats: int = 500) -> float:
    times = [run_func()["execution_time"] for _ in range(repeats)]
    return statistics.mean(times)


def main(repeats: int = 500) -> list[dict]:
    graph, coordinates, names = load_graph()
    rows: list[dict] = []

    for start, goal in TEST_PAIRS:
        d = dijkstra(graph, start, goal)
        a = astar(graph, coordinates, start, goal)

        # Equal-cost shortest routes can have different node sequences.
        if not math.isclose(d["distance"], a["distance"], abs_tol=1e-7):
            raise AssertionError(
                f"Result mismatch for {start}->{goal}: Dijkstra={d}, A*={a}"
            )

        d_avg = average_time(lambda: dijkstra(graph, start, goal), repeats)
        a_avg = average_time(lambda: astar(graph, coordinates, start, goal), repeats)

        rows.append(
            {
                "start": start,
                "start_name": names[start],
                "goal": goal,
                "goal_name": names[goal],
                "distance_m": d["distance"],
                "dijkstra_visited": d["visited_nodes"],
                "astar_visited": a["visited_nodes"],
                "visited_reduction_pct": round(
                    100.0 * (d["visited_nodes"] - a["visited_nodes"]) / d["visited_nodes"],
                    2,
                ),
                "dijkstra_avg_time_ms": round(d_avg * 1000.0, 6),
                "astar_avg_time_ms": round(a_avg * 1000.0, 6),
                "same_shortest_distance": True,
                "same_shortest_path": d["path"] == a["path"],
                "path": " -> ".join(d["path"]),
            }
        )

    output = Path(__file__).resolve().parent / "performance_results.csv"
    with output.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    print(f"Saved: {output}")
    for row in rows:
        print(
            f'{row["start"]}->{row["goal"]}: {row["distance_m"]:.1f} m | '
            f'Dijkstra {row["dijkstra_visited"]} nodes | '
            f'A* {row["astar_visited"]} nodes | '
            f'reduction {row["visited_reduction_pct"]:.1f}%'
        )
    return rows


if __name__ == "__main__":
    main()
