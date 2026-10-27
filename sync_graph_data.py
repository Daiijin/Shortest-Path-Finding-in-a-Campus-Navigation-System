"""Import validated CSV files and regenerate the JavaScript JSON dataset."""
from __future__ import annotations
import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'haui_astar_project'))
from graph_loader import load_dataset


def sync(nodes_file=None, edges_file=None, check=False):
    if bool(nodes_file) != bool(edges_file):
        raise ValueError('Supply both --nodes and --edges together')
    backend = ROOT / 'haui_astar_project'
    nodes_source = Path(nodes_file).resolve() if nodes_file else backend / 'nodes_project.csv'
    edges_source = Path(edges_file).resolve() if edges_file else backend / 'edges_project.csv'
    nodes, edges = load_dataset(nodes_source, edges_source)
    outputs = {ROOT / 'data/campus3/nodes.json': nodes, ROOT / 'data/campus3/edges.json': edges}
    campuses_path = ROOT / 'data/campuses.json'
    campuses = json.loads(campuses_path.read_text(encoding='utf-8')) if campuses_path.exists() else [{'id':'campus3','name':'HaUI Campus 3','zoom':18,'nodes':'data/campus3/nodes.json','edges':'data/campus3/edges.json'}]
    for campus in campuses:
        if campus['id'] == 'campus3':
            campus['center'] = [(min(n['lat'] for n in nodes)+max(n['lat'] for n in nodes))/2, (min(n['lon'] for n in nodes)+max(n['lon'] for n in nodes))/2]
    outputs[campuses_path] = campuses
    if check:
        for path, expected in outputs.items():
            if not path.exists() or json.loads(path.read_text(encoding='utf-8')) != expected:
                raise ValueError(f'JSON is out of sync: {path.relative_to(ROOT)}')
    else:
        for source, target in [(nodes_source, backend/'nodes_project.csv'), (edges_source, backend/'edges_project.csv')]:
            if source.resolve() != target.resolve():
                shutil.copyfile(source, target)
        for path, payload in outputs.items():
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_text(json.dumps(payload,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    print(f"{'Checked' if check else 'Synced'} {len(nodes)} nodes, {len(edges)} edges, {sum(e['enabled'] for e in edges)} enabled, {sum(not e['enabled'] for e in edges)} disabled")
    return nodes, edges


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--nodes');parser.add_argument('--edges');parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    sync(args.nodes,args.edges,args.check)
