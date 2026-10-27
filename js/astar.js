import {getNode} from './graph.js';
import {reconstruct} from './dijkstra.js';

export function geoHeuristic(a,b) {
  if(!a||!b)return 0;
  const meanLatitude=(a.lat+b.lat)*Math.PI/360;
  return Math.hypot((a.lon-b.lon)*110500*Math.cos(meanLatitude),(a.lat-b.lat)*110500);
}
export function astar(graph,start,goal,lookup=getNode) {
  if(!Object.hasOwn(graph,start)||!Object.hasOwn(graph,goal))return null;
  const scores=Object.fromEntries(Object.keys(graph).map(id=>[id,Infinity]));
  const estimates={},previous={},open=new Set([start]),closed=new Set();let visitedCount=0;
  scores[start]=0;estimates[start]=geoHeuristic(lookup(start),lookup(goal));
  while(open.size) {
    let current=null;
    for(const id of open)if(current===null||estimates[id]<estimates[current]||(estimates[id]===estimates[current]&&(scores[id]<scores[current]||(scores[id]===scores[current]&&id<current))))current=id;
    open.delete(current);closed.add(current);visitedCount++;
    if(current===goal)return {path:reconstruct(previous,start,goal),distance:scores[goal],visitedCount};
    for(const edge of graph[current]) {
      if(closed.has(edge.node))continue;
      const candidate=scores[current]+edge.distance;
      if(candidate<scores[edge.node]) {
        previous[edge.node]=current;scores[edge.node]=candidate;
        estimates[edge.node]=candidate+geoHeuristic(lookup(edge.node),lookup(goal));open.add(edge.node);
      }
    }
  }
  return null;
}
