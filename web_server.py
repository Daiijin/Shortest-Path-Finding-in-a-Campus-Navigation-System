"""Campus website and the existing Python algorithms, served on one origin."""
from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "haui_astar_project"))
from route_service import find_route, get_edges, get_nodes

MAX_BODY = 8192
NODES, EDGES = get_nodes(), get_edges()
NODE_BY_ID = {node["id"]: node for node in NODES}
LOCATIONS = {node["id"] for node in NODES if node["type"] == "location"}
STATIC_FILES = {"index.html", "css/style.css", "js/main.js", "js/map.js", "js/open_map.js", "js/api.js", "js/location.js"}
STATIC_FILES.update("vendor/leaflet/" + name for name in [
    "leaflet.css", "leaflet.js", "leaflet.js.map", "LICENSE",
    "images/layers.png", "images/layers-2x.png", "images/marker-icon.png",
    "images/marker-icon-2x.png", "images/marker-shadow.png",
])
STATIC_FILES.update("vendor/maplibre/" + name for name in [
    "maplibre-gl.mjs", "maplibre-gl-shared.mjs", "maplibre-gl-worker.mjs", "maplibre-gl.css", "LICENSE.txt",
])


def local_map_settings():
    path = ROOT / "maps_config.local.json"
    if not path.is_file():
        return {}
    settings = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(settings, dict):
        raise ValueError("maps_config.local.json must contain a JSON object")
    return settings


def config_payload():
    local = local_map_settings()
    # An old Google key must not silently override the user's Leaflet choice.
    provider = os.environ.get("MAP_PROVIDER", local.get("map_provider", "openfreemap")).strip().lower()
    provider = provider if provider in {"google", "leaflet", "openfreemap"} else "openfreemap"
    return {
        "map_provider": provider,
        "google_maps_api_key": os.environ.get("GOOGLE_MAPS_API_KEY", local.get("google_maps_api_key", "")).strip() if provider == "google" else "",
        "google_maps_map_id": os.environ.get("GOOGLE_MAPS_MAP_ID", local.get("google_maps_map_id", "DEMO_MAP_ID")).strip() or "DEMO_MAP_ID",
    }


def buildings_payload():
    return json.loads((ROOT / "data/campus3/buildings.geojson").read_text(encoding="utf-8"))


def basemap_payload():
    return json.loads((ROOT / "data/campus3/basemap.geojson").read_text(encoding="utf-8"))


def graph_payload():
    lats, lons = [n["lat"] for n in NODES], [n["lon"] for n in NODES]
    return {
        "campus": {
            "id": "campus3", "name": "HaUI · Cơ sở 3",
            "center": {"lat": (min(lats) + max(lats)) / 2, "lng": (min(lons) + max(lons)) / 2},
            "bounds": {"south": min(lats), "north": max(lats), "west": min(lons), "east": max(lons)},
        },
        "nodes": NODES, "edges": EDGES,
        "stats": {"locations": len(LOCATIONS), "nodes": len(NODES), "waypoints": len(NODES) - len(LOCATIONS), "edges": len(EDGES)},
    }


def route_payload(body):
    if not isinstance(body, dict):
        raise ValueError("Dữ liệu yêu cầu phải là một JSON object.")
    start, goal, algorithm = body.get("start"), body.get("goal"), body.get("algorithm", "astar")
    for value, label in [(start, "điểm bắt đầu"), (goal, "điểm đến")]:
        if not isinstance(value, str) or not value:
            raise ValueError(f"Hãy chọn {label}.")
        if value not in LOCATIONS:
            raise ValueError(f"{label.capitalize()} không hợp lệ hoặc không phải địa điểm có thể chọn.")
    if not isinstance(algorithm, str) or algorithm not in {"astar", "dijkstra"}:
        raise ValueError("Thuật toán phải là 'astar' hoặc 'dijkstra'.")
    result = find_route(start, goal, algorithm)
    result["found"] = bool(result["path"])
    result["path_coordinates"] = [
        {"id": node_id, "lat": NODE_BY_ID[node_id]["lat"], "lng": NODE_BY_ID[node_id]["lon"]}
        for node_id in result["path"]
    ]
    return result


class CampusHandler(BaseHTTPRequestHandler):
    server_version = "CampusNavigation/1.0"

    def log_message(self, format, *args):
        print(f"{self.command} {urlsplit(self.path).path} · {args[1] if len(args) > 1 else ''}", flush=True)

    def send_bytes(self, status, content, content_type, head=False):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if not head:
            self.wfile.write(content)

    def send_json(self, status, payload, head=False):
        self.send_bytes(status, json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8"), "application/json; charset=utf-8", head)

    def error(self, status, message, code="invalid_request"):
        self.send_json(status, {"error": {"code": code, "message": message}})

    def do_GET(self):
        self.get_resource()

    def do_HEAD(self):
        self.get_resource(head=True)

    def get_resource(self, head=False):
        path = unquote(urlsplit(self.path).path)
        if path == "/api/health":
            self.send_json(200, {"status": "ok", "algorithms": ["astar", "dijkstra"], "nodes": len(NODES), "edges": len(EDGES)}, head)
        elif path == "/api/graph":
            self.send_json(200, graph_payload(), head)
        elif path == "/api/buildings":
            self.send_json(200, buildings_payload(), head)
        elif path == "/api/basemap":
            self.send_json(200, basemap_payload(), head)
        elif path == "/api/config":
            self.send_json(200, config_payload(), head)
        else:
            file_name = "index.html" if path == "/" else path.lstrip("/")
            if file_name not in STATIC_FILES or not (ROOT / file_name).is_file():
                self.error(404, "Không tìm thấy tài nguyên.", "not_found")
                return
            mime = "text/javascript" if file_name.endswith((".js", ".mjs")) else mimetypes.guess_type(file_name)[0] or "application/octet-stream"
            if mime.startswith("text/") or mime == "application/json":
                mime += "; charset=utf-8"
            self.send_bytes(200, (ROOT / file_name).read_bytes(), mime, head)

    def do_POST(self):
        if urlsplit(self.path).path != "/api/route":
            self.error(404, "Không tìm thấy API.", "not_found")
            return
        origin = self.headers.get("Origin")
        if origin and urlsplit(origin).netloc != self.headers.get("Host"):
            self.error(403, "Yêu cầu phải đến từ website Campus Navigation.", "origin_not_allowed")
            return
        if self.headers.get("Content-Type", "").split(";")[0].strip().lower() != "application/json":
            self.error(415, "Gửi dữ liệu với Content-Type: application/json.", "unsupported_media_type")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.error(400, "Content-Length không hợp lệ.")
            return
        if not 0 < length <= MAX_BODY:
            self.error(413 if length > MAX_BODY else 400, "Kích thước yêu cầu không hợp lệ.")
            return
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            self.send_json(200, route_payload(body))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.error(400, "Dữ liệu JSON không hợp lệ.")
        except ValueError as error:
            self.error(400, str(error))
        except Exception:
            self.error(500, "Backend gặp lỗi khi tìm đường. Kiểm tra dữ liệu graph.", "algorithm_error")


def main():
    parser = argparse.ArgumentParser(description="Campus website + Python A*/Dijkstra API")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--open", action="store_true")
    args = parser.parse_args()
    try:
        server = ThreadingHTTPServer((args.host, args.port), CampusHandler)
    except OSError as error:
        parser.exit(1, f"Không khởi động được server: {error}\nThử --port 8766 nếu cổng đang được sử dụng.\n")
    url = f"http://{'127.0.0.1' if args.host == '0.0.0.0' else args.host}:{args.port}"
    print(f"Campus Navigation: {url}\nPython backend: A* + Dijkstra · {len(NODES)} nodes · {len(EDGES)} edges\nCtrl+C to stop.", flush=True)
    if args.open:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
