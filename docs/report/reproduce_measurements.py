import sys,json,platform,statistics,csv,math,hashlib
from pathlib import Path
repo=Path(__file__).resolve().parents[2]
out=Path(__file__).resolve().parent
sys.path.insert(0,str(repo/'haui_astar_project'))
from graph_loader import load_graph,load_dataset
from astar import astar
from dijkstra import dijkstra
from compare_algorithms import TEST_PAIRS
from route_service import find_route
graph,coordinates,names=load_graph()
rows=[]
for start,goal in TEST_PAIRS:
    for _ in range(30):
        astar(graph,coordinates,start,goal);dijkstra(graph,start,goal)
    times={'a':[],'d':[]}
    for i in range(500):
        for key in (['a','d'] if i%2==0 else ['d','a']):
            result=astar(graph,coordinates,start,goal) if key=='a' else dijkstra(graph,start,goal)
            times[key].append(result['execution_time']*1000)
    a=astar(graph,coordinates,start,goal);d=dijkstra(graph,start,goal)
    assert math.isclose(a['distance'],d['distance'],abs_tol=1e-7)
    rows.append(dict(start=start,goal=goal,start_name=names[start],goal_name=names[goal],distance=a['distance'],path_nodes=len(a['path']),
        a_nodes=a['visited_nodes'],d_nodes=d['visited_nodes'],reduction=100*(d['visited_nodes']-a['visited_nodes'])/d['visited_nodes'],
        a_ms=statistics.mean(times['a']),d_ms=statistics.mean(times['d']),same_path=a['path']==d['path']))
nodes,edges=load_dataset()
all_pairs=0;different_paths=0
locations={n['id'] for n in nodes if n['type']=='location'}
for start in graph:
    for goal in graph:
        a=astar(graph,coordinates,start,goal);d=dijkstra(graph,start,goal)
        assert math.isclose(a['distance'],d['distance'],abs_tol=1e-7),(start,goal)
        all_pairs+=1
        if start in locations and goal in locations and a['path']!=d['path']:different_paths+=1
report={'date':'2026-10-29','environment':platform.platform(),'python':platform.python_version(),'repeats':500,'warmup':30,
 'rows':rows,'route_example':find_route('N001','N017'),'mean_reduction':statistics.mean(r['reduction'] for r in rows),
 'mean_a_ms':statistics.mean(r['a_ms'] for r in rows),'mean_d_ms':statistics.mean(r['d_ms'] for r in rows),
 'all_node_pairs_checked':all_pairs,'selectable_pairs_different_optimal_path':different_paths,
 'tests':{'data':4,'api':15,'javascript':12,'total':31},
 'hashes':{name:hashlib.sha256((repo/'haui_astar_project'/name).read_bytes()).hexdigest() for name in ['nodes_project.csv','edges_project.csv']}}
(out/'measurements.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
with (out/'measurements.csv').open('w',encoding='utf-8-sig',newline='') as file:
    writer=csv.DictWriter(file,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
print(json.dumps({k:v for k,v in report.items() if k not in ['route_example','hashes']},ensure_ascii=False,indent=2))
