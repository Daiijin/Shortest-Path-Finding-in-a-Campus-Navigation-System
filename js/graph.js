/** Shared graph metadata rules for the website and standalone JS algorithms. */
export let nodes=[],edges=[],graph={};
let nodeById=new Map();

export function booleanFlag(value,defaultValue=false) {
  if(value===undefined||value===null||value==='')return defaultValue;
  if(value===true||value===1)return true;
  if(value===false||value===0)return false;
  const text=String(value).trim().toLowerCase();
  if(['true','1','yes'].includes(text))return true;
  if(['false','0','no'].includes(text))return false;
  throw new Error('Giá trị boolean không hợp lệ: '+String(value));
}
export const isEdgeEnabled=edge=>booleanFlag(edge.enabled,true);
export const needsReview=edge=>booleanFlag(edge.needsReview,false);
export const nodeLabel=node=>node.displayName||node.name||node.id;
export const isSelectableLocation=node=>node.type==='location';
export const isVisibleLocation=node=>isSelectableLocation(node)&&booleanFlag(node.showOnMap,true);

export function buildGraph(nodeList=nodes,edgeList=edges) {
  const normalizedNodes=nodeList.map(node=>({...node,lat:Number(node.lat),lon:Number(node.lon),
    displayName:nodeLabel(node),showOnMap:booleanFlag(node.showOnMap,node.type==='location'),isTurn:booleanFlag(node.isTurn,false)}));
  const lookup=new Map();
  for(const node of normalizedNodes) {
    if(!node.id||lookup.has(node.id)||!Number.isFinite(node.lat)||!Number.isFinite(node.lon)||Math.abs(node.lat)>90||Math.abs(node.lon)>180)
      throw new Error('Node không hợp lệ hoặc trùng ID: '+node.id);
    lookup.set(node.id,node);
  }
  const normalizedEdges=edgeList.map(edge=>({...edge,distance:Number(edge.distance),enabled:isEdgeEnabled(edge),needsReview:needsReview(edge)}));
  const adjacency=Object.fromEntries(normalizedNodes.map(node=>[node.id,[]]));
  for(const edge of normalizedEdges) {
    if(!lookup.has(edge.from)||!lookup.has(edge.to)||!Number.isFinite(edge.distance)||edge.distance<0)
      throw new Error('Cạnh không hợp lệ: '+(edge.id||edge.from+' → '+edge.to));
    if(!edge.enabled)continue;
    adjacency[edge.from].push({node:edge.to,distance:edge.distance,id:edge.id,needsReview:edge.needsReview});
    adjacency[edge.to].push({node:edge.from,distance:edge.distance,id:edge.id,needsReview:edge.needsReview});
  }
  nodes=normalizedNodes;edges=normalizedEdges;nodeById=lookup;graph=adjacency;
  return graph;
}
export async function loadGraph(nodeFile='data/campus3/nodes.json',edgeFile='data/campus3/edges.json') {
  const responses=await Promise.all([fetch(nodeFile),fetch(edgeFile)]);
  if(responses.some(response=>!response.ok))throw new Error('Không tải được dữ liệu graph.');
  const [nodeList,edgeList]=await Promise.all(responses.map(response=>response.json()));
  buildGraph(nodeList,edgeList);return {nodes,edges,graph};
}
export function getNode(id) {return nodeById.get(id);}
