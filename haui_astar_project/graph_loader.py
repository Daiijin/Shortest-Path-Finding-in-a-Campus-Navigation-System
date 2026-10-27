"""Read CSV metadata and build the routing graph from enabled edges only."""

from __future__ import annotations

import csv
import math
from pathlib import Path
from typing import Dict, List, Tuple

Graph = Dict[str, List[Tuple[str, float]]]
Coordinates = Dict[str, Tuple[float, float]]
BASE = Path(__file__).resolve().parent


def parse_flag(value, default: bool, field: str) -> bool:
    if value is None or str(value).strip() == "":
        return default
    text = str(value).strip().lower()
    if text in {"true", "1", "yes"}:
        return True
    if text in {"false", "0", "no"}:
        return False
    raise ValueError(f"Invalid boolean for {field}: {value!r}")


def _rows(file: str | Path) -> list[dict]:
    path = Path(file)
    if not path.is_absolute():
        path = BASE / path
    with path.open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def _field(row: dict, key: str, legacy: str, default=""):
    return row.get(key, row.get(legacy, default))


def load_dataset(nodes_file: str | Path = "nodes_project.csv", edges_file: str | Path = "edges_project.csv") -> tuple[list[dict], list[dict]]:
    """Support metadata CSV columns and the original assignment column names."""
    nodes, edges = [], []
    ids = set()
    for row in _rows(nodes_file):
        node_id = _field(row, "id", "Node_ID").strip()
        name = _field(row, "name", "Node_Name").strip()
        if not node_id or node_id in ids or not name:
            raise ValueError(f"Missing/duplicate node ID or name: {node_id!r}")
        lat = float(_field(row, "lat", "Latitude"))
        lon = float(_field(row, "lon", "Longitude"))
        if not math.isfinite(lat) or not math.isfinite(lon) or not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError(f"Invalid coordinates for {node_id}")
        node_type = row.get("type", "").strip() or ("waypoint" if name.startswith("Routing Node ") else "location")
        if node_type not in {"location", "waypoint"}:
            raise ValueError(f"Invalid node type for {node_id}: {node_type}")
        nodes.append({"id": node_id, "name": name, "lat": lat, "lon": lon, "type": node_type,
                      "displayName": row.get("displayName", "").strip() or name,
                      "showOnMap": parse_flag(row.get("showOnMap"), node_type == "location", f"{node_id}.showOnMap"),
                      "isTurn": parse_flag(row.get("isTurn"), False, f"{node_id}.isTurn")})
        ids.add(node_id)
    if not nodes:
        raise ValueError("The node dataset is empty")
    names = {node["id"]: node["name"] for node in nodes}
    edge_ids, pairs = set(), set()
    for index, row in enumerate(_rows(edges_file), 1):
        edge_id = row.get("id", "").strip() or f"E{index:03d}"
        start = _field(row, "from", "From_Node").strip()
        goal = _field(row, "to", "To_Node").strip()
        if start not in ids or goal not in ids:
            raise ValueError(f"Edge {edge_id} refers to an unknown node: {start} -> {goal}")
        pair = tuple(sorted((start, goal)))
        if edge_id in edge_ids or pair in pairs:
            raise ValueError(f"Duplicate edge ID or undirected pair: {edge_id}")
        distance = float(_field(row, "distance", "Distance_m"))
        if not math.isfinite(distance) or distance < 0:
            raise ValueError(f"Invalid non-negative metre weight for {edge_id}")
        edges.append({"id": edge_id, "from": start, "fromName": row.get("fromName", "").strip() or names[start],
                      "to": goal, "toName": row.get("toName", "").strip() or names[goal], "distance": distance,
                      "enabled": parse_flag(row.get("enabled"), True, f"{edge_id}.enabled"),
                      "needsReview": parse_flag(row.get("needsReview"), False, f"{edge_id}.needsReview"),
                      "reviewReason": row.get("reviewReason", "").strip()})
        edge_ids.add(edge_id)
        pairs.add(pair)
    return nodes, edges


def build_graph(nodes: list[dict], edges: list[dict]) -> Graph:
    graph = {node["id"]: [] for node in nodes}
    for edge in edges:
        if not edge["enabled"]:
            continue
        graph[edge["from"]].append((edge["to"], edge["distance"]))
        graph[edge["to"]].append((edge["from"], edge["distance"]))
    return graph


def load_graph(nodes_file: str | Path = "nodes_project.csv", edges_file: str | Path = "edges_project.csv") -> tuple[Graph, Coordinates, dict[str, str]]:
    nodes, edges = load_dataset(nodes_file, edges_file)
    return build_graph(nodes, edges), {n["id"]: (n["lat"], n["lon"]) for n in nodes}, {n["id"]: n["displayName"] for n in nodes}
