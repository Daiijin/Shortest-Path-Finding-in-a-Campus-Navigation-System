"""HTTP integration tests: browser-facing API calls the original Python algorithms."""
import http.client
import json
import threading
import unittest
from unittest.mock import patch

import web_server
from dijkstra import dijkstra
from route_service import find_route


class WebsiteApiTests(unittest.TestCase):
    def setUp(self):
        settings = patch("web_server.local_map_settings", return_value={})
        settings.start()
        self.addCleanup(settings.stop)

    @classmethod
    def setUpClass(cls):
        cls.server = web_server.ThreadingHTTPServer(("127.0.0.1", 0), web_server.CampusHandler)
        cls.port = cls.server.server_port
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def request(self, method, path, payload=None, raw=None, headers=None):
        body = json.dumps(payload).encode() if payload is not None else raw
        request_headers = {"Content-Type": "application/json"} if body is not None else {}
        request_headers.update(headers or {})
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        try:
            connection.request(method, path, body=body, headers=request_headers)
            response = connection.getresponse()
            content = response.read()
            return response.status, dict(response.getheaders()), content
        finally:
            connection.close()

    def post_route(self, **payload):
        status, headers, content = self.request("POST", "/api/route", payload)
        return status, json.loads(content)

    def test_health_and_graph_share_backend_dataset(self):
        status, _, content = self.request("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(content)["algorithms"], ["astar", "dijkstra"])
        status, _, content = self.request("GET", "/api/graph")
        graph = json.loads(content)
        self.assertEqual(status, 200)
        self.assertEqual(graph["stats"], {"locations": 44, "nodes": 87, "waypoints": 43, "edges": 128, "edges_total": 134, "disabled_edges": 6, "review_edges": 23})
        self.assertEqual(graph["nodes"], web_server.get_nodes())
        self.assertEqual(graph["edges"], web_server.get_edges(include_disabled=True))

    def test_disabled_roads_are_not_in_routes_and_review_metadata_is_retained(self):
        for algorithm in ['astar','dijkstra']:
            status,result=self.post_route(start='N001',goal='N017',algorithm=algorithm)
            self.assertEqual(status,200)
            self.assertAlmostEqual(result['distance'],688.2)
            self.assertTrue({'E006','E015','E058','E062','E087','E092'}.isdisjoint(edge['id'] for edge in result['path_edges']))
            self.assertTrue(all(edge['enabled'] for edge in result['path_edges']))
        status,result=self.post_route(start='N001',goal='N017',algorithm='astar')
        self.assertAlmostEqual(result['distance'],688.2)
        self.assertEqual(len(result['path']),16)
        self.assertEqual(result['needsReview'],bool(result['review_edges']))
        self.assertTrue(result['needsReview'])
        self.assertEqual([edge['id'] for edge in result['review_edges']],['E096'])
        self.assertTrue(all(edge['needsReview'] and edge['reviewReason'] for edge in result['review_edges']))

    def test_static_javascript_dataset_matches_python_api(self):
        for file_name,payload in [('nodes',web_server.get_nodes()),('edges',web_server.get_edges(include_disabled=True))]:
            status,_,content=self.request('GET',f'/data/campus3/{file_name}.json')
            self.assertEqual(status,200)
            self.assertEqual(json.loads(content),payload)

    def test_building_footprints_have_real_closed_coordinate_rings(self):
        status, _, content = self.request("GET", "/api/buildings")
        data=json.loads(content)
        self.assertEqual(status,200)
        self.assertEqual(data["type"],"FeatureCollection")
        self.assertEqual(len(data["features"]),23)
        self.assertEqual(data["source"]["license"],"ODbL 1.0")
        for feature in data["features"]:
            self.assertEqual(feature["geometry"]["type"],"Polygon")
            ring=feature["geometry"]["coordinates"][0]
            self.assertGreaterEqual(len(ring),4)
            self.assertEqual(ring[0],ring[-1])
            self.assertTrue(all(105.88<lng<105.91 and 20.53<lat<20.56 for lng,lat in ring))

    def test_both_algorithms_match_original_backend(self):
        for algorithm in ["astar", "dijkstra"]:
            for start, goal in [("N001", "N017"), ("N027", "N026"), ("N045", "N033")]:
                with self.subTest(algorithm=algorithm, start=start, goal=goal):
                    status, result = self.post_route(start=start, goal=goal, algorithm=algorithm)
                    original = find_route(start, goal, algorithm)
                    self.assertEqual(status, 200)
                    for key in ["algorithm", "path", "distance", "visited_nodes", "path_names"]:
                        self.assertEqual(result[key], original[key])
                    self.assertTrue(result["found"])
                    self.assertEqual([p["id"] for p in result["path_coordinates"]], result["path"])
                    self.assertTrue(any(web_server.NODE_BY_ID[n]["type"] == "waypoint" for n in result["path"]))
                    for point in result["path_coordinates"]:
                        node = web_server.NODE_BY_ID[point["id"]]
                        self.assertEqual((point["lat"], point["lng"]), (node["lat"], node["lon"]))

    def test_same_node_for_both_algorithms(self):
        for algorithm in ["astar", "dijkstra"]:
            status, result = self.post_route(start="N001", goal="N001", algorithm=algorithm)
            self.assertEqual(status, 200)
            self.assertTrue(result["found"])
            self.assertEqual(result["distance"], 0)
            self.assertEqual(result["path"], ["N001"])

    def test_invalid_and_missing_location(self):
        for payload in [{}, {"start": "N001"}, {"start": "N999", "goal": "N017"}, {"start": "N011", "goal": "N017"}, {"start": ["N001"], "goal": "N017"}, {"start": "N001", "goal": "N017", "algorithm": "invalid"}]:
            with self.subTest(payload=payload):
                status, result = self.post_route(**payload)
                self.assertEqual(status, 400)
                self.assertIn("message", result["error"])

    def test_malformed_json_and_media_type(self):
        for raw in [b"{broken", b"null", b"[]", b'"text"']:
            status, _, content = self.request("POST", "/api/route", raw=raw)
            self.assertEqual(status, 400)
            self.assertIn("error", json.loads(content))
        status, _, _ = self.request("POST", "/api/route", raw=b"start=N001", headers={"Content-Type": "application/x-www-form-urlencoded"})
        self.assertEqual(status, 415)

    def test_no_route_keeps_metrics_available(self):
        def disconnected(start, goal, algorithm):
            return dijkstra({"N001": [], "N017": []}, start, goal)
        with patch("web_server.find_route", side_effect=disconnected):
            status, result = self.post_route(start="N001", goal="N017", algorithm="dijkstra")
        self.assertEqual(status, 200)
        self.assertFalse(result["found"])
        self.assertIsNone(result["distance"])
        self.assertEqual(result["path_coordinates"], [])
        self.assertEqual(result["visited_nodes"], 1)

    def test_static_files_and_private_files(self):
        for path in ["/"] + ["/" + name for name in sorted(web_server.STATIC_FILES)]:
            status, headers, content = self.request("GET", path)
            self.assertEqual(status, 200)
            self.assertGreater(len(content), 20)
        for path in ["/Plan.xlsx", "/Phan_cong_cong_viec_Week_5_6.docx", "/haui_astar_project/nodes_project.csv", "/../Plan.xlsx", "/%2e%2e/Plan.xlsx", "/.env", "/maps_config.local.json"]:
            self.assertEqual(self.request("GET", path)[0], 404)
        status, headers, body = self.request("HEAD", "/")
        self.assertEqual(status, 200)
        self.assertEqual(body, b"")
        self.assertGreater(int(headers["Content-Length"]), 100)

    def test_configuration_is_explicit_and_not_cached(self):
        with patch.dict(web_server.os.environ, {"MAP_PROVIDER": "google", "GOOGLE_MAPS_API_KEY": "test-public-key", "GOOGLE_MAPS_MAP_ID": "test-map-id"}):
            status, headers, content = self.request("GET", "/api/config")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(content), {"map_provider": "google", "google_maps_api_key": "test-public-key", "google_maps_map_id": "test-map-id"})
        self.assertEqual(headers["Cache-Control"], "no-store")

    def test_free_map_is_default_even_with_an_existing_google_key(self):
        with patch.dict(web_server.os.environ, {"GOOGLE_MAPS_API_KEY": "old-public-key"}, clear=True):
            status, _, content = self.request("GET", "/api/config")
        self.assertEqual(status, 200)
        config = json.loads(content)
        self.assertEqual(config["map_provider"], "openfreemap")
        self.assertEqual(config["google_maps_api_key"], "")
        status, headers, image = self.request("GET", "/vendor/leaflet/images/layers.png")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "image/png")
        self.assertTrue(image.startswith(b"\x89PNG\r\n\x1a\n"))

    def test_local_basemap_has_roads_water_and_valid_geometry(self):
        status, _, content = self.request("GET", "/api/basemap")
        data = json.loads(content)
        self.assertEqual(status, 200)
        self.assertEqual(data["source"]["license"], "ODbL 1.0")
        kinds = {feature["properties"]["kind"] for feature in data["features"]}
        self.assertTrue({"road", "water", "campus", "sport"}.issubset(kinds))
        for feature in data["features"]:
            geometry=feature["geometry"]
            coordinates=geometry["coordinates"][0] if geometry["type"]=="Polygon" else geometry["coordinates"]
            self.assertGreaterEqual(len(coordinates),2)
            if geometry["type"]=="Polygon":
                self.assertEqual(coordinates[0],coordinates[-1])
            self.assertTrue(all(-180<=lng<=180 and -90<=lat<=90 for lng,lat in coordinates))
        status,headers,_=self.request("GET","/vendor/maplibre/maplibre-gl-worker.mjs")
        self.assertEqual(status,200)
        self.assertTrue(headers["Content-Type"].startswith("text/javascript"))

    def test_other_origin_and_oversized_request(self):
        status, _, _ = self.request("POST", "/api/route", {"start": "N001", "goal": "N017"}, headers={"Origin": "https://example.com"})
        self.assertEqual(status, 403)
        status, _, _ = self.request("POST", "/api/route", raw=b"x" * 9000)
        self.assertEqual(status, 413)

    def test_local_google_configuration_and_environment_override(self):
        local = {"map_provider": "google", "google_maps_api_key": "test-local-key", "google_maps_map_id": "test-map-id"}
        with patch("web_server.local_map_settings", return_value=local), patch.dict(web_server.os.environ, {}, clear=True):
            self.assertEqual(web_server.config_payload(), local)
            with patch.dict(web_server.os.environ, {"MAP_PROVIDER": "leaflet"}):
                self.assertEqual(web_server.config_payload()["google_maps_api_key"], "")


if __name__ == "__main__":
    unittest.main(verbosity=2)
