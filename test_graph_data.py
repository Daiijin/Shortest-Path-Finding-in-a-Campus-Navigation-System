"""Regression checks for CSV flags, dataset synchronization and optimal routes."""
import json
import math
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'haui_astar_project'))
from graph_loader import load_dataset,load_graph
from astar import astar
from dijkstra import dijkstra
from route_service import get_nodes,get_edges,find_route


class GraphDatasetTests(unittest.TestCase):
    def test_csv_and_json_share_ids_metadata_and_disabled_edges(self):
        nodes,edges=load_dataset()
        self.assertEqual(nodes,json.loads((ROOT/'data/campus3/nodes.json').read_text(encoding='utf-8')))
        self.assertEqual(edges,json.loads((ROOT/'data/campus3/edges.json').read_text(encoding='utf-8')))
        self.assertEqual(len(nodes),155)
        self.assertEqual(len(edges),172)
        self.assertEqual(sum(n['type']=='location' for n in nodes),44)
        self.assertEqual({e['id'] for e in edges if not e['enabled']},set())
        self.assertEqual(sum(e['needsReview'] for e in edges),29)
        self.assertEqual(sum(n['isTurn'] for n in nodes),77)
        self.assertEqual(next(n for n in nodes if n['id']=='N028')['displayName'],'Hồ Nước')
        self.assertTrue(all(isinstance(n['showOnMap'],bool) for n in nodes))

    def test_loader_honors_explicit_type_and_false_strings(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder=Path(temporary);nodes=folder/'nodes.csv';edges=folder/'edges.csv'
            nodes.write_text('id,name,lat,lon,type,displayName,showOnMap,isTurn\nA,Routing Node example,20,105,location,Main Gate,False,False\nB,Corner,20.00001,105,waypoint,Turn,False,True\nC,Library,20.00002,105,location,Library,True,False\n',encoding='utf-8-sig')
            edges.write_text('id,from,to,distance,enabled,needsReview,reviewReason\nclosed,A,C,1,False,True,closed shortcut\nAB,A,B,5,True,True,survey pending\nBC,B,C,7,True,False,\n',encoding='utf-8-sig')
            node_data,edge_data=load_dataset(nodes,edges)
            self.assertEqual(node_data[0]['type'],'location')
            self.assertFalse(node_data[0]['showOnMap'])
            self.assertTrue(node_data[1]['isTurn'])
            graph,coordinates,names=load_graph(nodes,edges)
            self.assertEqual(names['A'],'Main Gate')
            self.assertEqual(dijkstra(graph,'A','C')['distance'],12)
            self.assertEqual(astar(graph,coordinates,'A','C')['path'],['A','B','C'])
            self.assertFalse(edge_data[0]['enabled'])
            edges.write_text('from,to,distance,enabled\nA,B,-1,True\n',encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'weight'):
                load_dataset(nodes,edges)

    def test_legacy_csv_schema_still_loads(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder=Path(temporary);nodes=folder/'nodes.csv';edges=folder/'edges.csv'
            nodes.write_text('Node_ID,Node_Name,Latitude,Longitude\nA,Gate,20,105\nB,Routing Node 01,20.00001,105\n',encoding='utf-8')
            edges.write_text('From_Node,To_Node,Distance_m\nA,B,5\n',encoding='utf-8')
            node_data,edge_data=load_dataset(nodes,edges)
            self.assertEqual(node_data[1]['type'],'waypoint')
            self.assertFalse(node_data[1]['showOnMap'])
            self.assertTrue(edge_data[0]['enabled'])
            self.assertFalse(edge_data[0]['needsReview'])

    def test_all_selectable_routes_match_dijkstra_and_exclude_closed_roads(self):
        graph,coordinates,_=load_graph()
        closed={frozenset((e['from'],e['to'])) for e in get_edges(True) if not e['enabled']}
        locations=[n['id'] for n in get_nodes() if n['type']=='location']
        for start in locations:
            for goal in locations:
                a=astar(graph,coordinates,start,goal);d=dijkstra(graph,start,goal)
                self.assertTrue(math.isclose(a['distance'],d['distance'],abs_tol=1e-7),f'{start}->{goal}: {a["distance"]} != {d["distance"]}')
                for result in (a,d):
                    self.assertEqual((result['path'][0],result['path'][-1]),(start,goal))
                    cost=0
                    for u,v in zip(result['path'],result['path'][1:]):
                        self.assertNotIn(frozenset((u,v)),closed)
                        weights=[weight for neighbor,weight in graph[u] if neighbor==v]
                        self.assertEqual(len(weights),1,'Every route segment must be an enabled graph edge')
                        cost+=weights[0]
                    self.assertTrue(math.isclose(cost,result['distance'],abs_tol=1e-7))


if __name__=='__main__':unittest.main()
