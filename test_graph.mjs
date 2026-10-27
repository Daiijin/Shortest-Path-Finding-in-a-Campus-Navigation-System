import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildGraph,isEdgeEnabled,isVisibleLocation,isSelectableLocation,nodeLabel} from './js/graph.js';
import {astar} from './js/astar.js';
import {dijkstra} from './js/dijkstra.js';

const nodes=JSON.parse(await readFile(new URL('./data/campus3/nodes.json',import.meta.url),'utf8'));
const edges=JSON.parse(await readFile(new URL('./data/campus3/edges.json',import.meta.url),'utf8'));

test('CSV flags control routing, marker visibility and display labels',()=>{
  assert.equal(isEdgeEnabled({enabled:'False'}),false);
  assert.equal(isEdgeEnabled({enabled:false}),false);
  assert.equal(isEdgeEnabled({}),true);
  const hidden={id:'A',name:'Old',displayName:'Gate',type:'location',showOnMap:'False'};
  assert.equal(isVisibleLocation(hidden),false);
  assert.equal(isSelectableLocation(hidden),true);
  assert.equal(nodeLabel(hidden),'Gate');
  assert.equal(nodes.filter(isVisibleLocation).length,44);
  assert.equal(edges.filter(isEdgeEnabled).length,128);
});

test('locked shortcut is never inserted into the JS graph',()=>{
  const graph=buildGraph(nodes,edges);
  for(const edge of edges.filter(edge=>!isEdgeEnabled(edge))) {
    assert.ok(!graph[edge.from].some(neighbor=>neighbor.node===edge.to));
    assert.ok(!graph[edge.to].some(neighbor=>neighbor.node===edge.from));
  }
  for(const search of [astar,dijkstra]) {
    const result=search(graph,'N002','N038');
    assert.ok(Math.abs(result.distance-106)<1e-8);
    assert.notDeepEqual(result.path,['N002','N038']);
    assert.ok(Math.abs(search(graph,'N001','N017').distance-688.2)<1e-8);
  }
});

test('JS A* and Dijkstra agree for every selectable start and destination',()=>{
  const graph=buildGraph(nodes,edges),locations=nodes.filter(isSelectableLocation);
  for(const start of locations)for(const goal of locations) {
    const a=astar(graph,start.id,goal.id),d=dijkstra(graph,start.id,goal.id);
    assert.ok(Math.abs(a.distance-d.distance)<1e-7,`${start.id}->${goal.id}: ${a.distance} != ${d.distance}`);
  }
});

test('unreachable, same-node and invalid data are handled',()=>{
  const graph=buildGraph([{id:'A',name:'A',lat:20,lon:105,type:'location'},{id:'B',name:'B',lat:20.001,lon:105,type:'location'}],[]);
  for(const search of [astar,dijkstra]) {
    assert.equal(search(graph,'A','B'),null);
    assert.deepEqual(search(graph,'A','A').path,['A']);
    assert.equal(search(graph,'A','missing'),null);
  }
  assert.throws(()=>buildGraph(nodes,[{from:'N001',to:'missing',distance:1}]),/Cạnh/);
  assert.throws(()=>buildGraph(nodes,[{from:'N001',to:'N002',distance:NaN}]),/Cạnh/);
});
