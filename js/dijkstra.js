export function reconstruct(previous,start,goal) {
  const path=[];let current=goal;
  while(current!==null&&current!==undefined) {path.push(current);if(current===start)break;current=previous[current];}
  path.reverse();return path[0]===start?path:[];
}
export function dijkstra(graph,start,goal) {
  if(!Object.hasOwn(graph,start)||!Object.hasOwn(graph,goal))return null;
  const distances=Object.fromEntries(Object.keys(graph).map(id=>[id,Infinity]));
  const previous={},closed=new Set();let visitedCount=0;distances[start]=0;
  while(true) {
    let current=null,best=Infinity;
    for(const id of Object.keys(graph))if(!closed.has(id)&&distances[id]<best){best=distances[id];current=id;}
    if(current===null)return null;
    closed.add(current);visitedCount++;
    if(current===goal)return {path:reconstruct(previous,start,goal),distance:distances[goal],visitedCount};
    for(const edge of graph[current])if(!closed.has(edge.node)) {
      const candidate=distances[current]+edge.distance;
      if(candidate<distances[edge.node]){distances[edge.node]=candidate;previous[edge.node]=current;}
    }
  }
}
