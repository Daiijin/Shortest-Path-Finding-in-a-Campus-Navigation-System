"""Load the HaUI campus graph from CSV files."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Dict, List, Tuple

Graph = Dict[str, List[Tuple[str, float]]]
Coordinates = Dict[str, Tuple[float, float]]


def load_graph(
    nodes_file: str | Path = "nodes_project.csv",
    edges_file: str | Path = "edges_project.csv",
) -> tuple[Graph, Coordinates, dict[str, str]]:
    base = Path(__file__).resolve().parent
    nodes_path = Path(nodes_file)
    edges_path = Path(edges_file)
    if not nodes_path.is_absolute():
        nodes_path = base / nodes_path
    if not edges_path.is_absolute():
        edges_path = base / edges_path

    graph: Graph = {}
    coordinates: Coordinates = {}
    names: dict[str, str] = {}

    with nodes_path.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            node_id = row["Node_ID"].strip()
            graph[node_id] = []
            coordinates[node_id] = (float(row["Latitude"]), float(row["Longitude"]))
            names[node_id] = row["Node_Name"].strip()

    # Roads are treated as undirected: one edge can be walked in both directions.
    with edges_path.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            u = row["From_Node"].strip()
            v = row["To_Node"].strip()
            w = float(row["Distance_m"])
            if u not in graph or v not in graph:
                raise ValueError(f"Edge refers to unknown node: {u} <-> {v}")
            if w < 0:
                raise ValueError("Dijkstra/A* require non-negative edge weights")
            graph[u].append((v, w))
            graph[v].append((u, w))

    return graph, coordinates, names
