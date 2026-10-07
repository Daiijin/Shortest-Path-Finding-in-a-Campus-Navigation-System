import {Map as GLMap, Marker, NavigationControl, ScaleControl, setWorkerUrl} from '../vendor/maplibre/maplibre-gl.mjs';

setWorkerUrl('/vendor/maplibre/maplibre-gl-worker.mjs');
const empty = () => ({type:'FeatureCollection',features:[]});
const collection = features => ({type:'FeatureCollection',features});
const line = coordinates => ({type:'Feature',properties:{},geometry:{type:'LineString',coordinates}});

function localStyle(data) {
  return {version:8,sources:{campusBase:{type:'geojson',data:data.basemap,attribution:'<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>'}},layers:[
    {id:'background',type:'background',paint:{'background-color':'#f3f5ef'}},
    {id:'campus-land',type:'fill',source:'campusBase',filter:['all',['==',['geometry-type'],'Polygon'],['!=',['get','kind'],'water']],paint:{'fill-color':['match',['get','kind'],'sport','#bbd5aa','green','#d7e8ca','campus','#e8eddf','#ede9df'],'fill-opacity':.85}},
    {id:'campus-water',type:'fill',source:'campusBase',filter:['==',['get','kind'],'water'],paint:{'fill-color':'#a7d9e8'}},
    {id:'campus-streets-border',type:'line',source:'campusBase',filter:['==',['get','kind'],'road'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#d2cdbc','line-width':['interpolate',['linear'],['zoom'],14,2,19,12]}},
    {id:'campus-streets',type:'line',source:'campusBase',filter:['==',['get','kind'],'road'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fffdf6','line-width':['interpolate',['linear'],['zoom'],14,1,19,9]}},
  ]};
}

export class OpenMap {
  constructor(container,data,handlers,pinContent,gpsPin) {
    this.provider='MapLibre · Campus';this.data=data;this.handlers=handlers;
    this.pinContent=pinContent;this.gpsPin=gpsPin;
    this.currentSelection=[null,null,false];this.visibleGraph=true;this.visibleBuildings=true;
    this.result=null;this.position=null;this.mode='roadmap';this.remote=false;
    this.nodes=new Map(data.nodes.map(node=>[node.id,node]));
    this.map=new GLMap({container,style:localStyle(data),center:[data.campus.center.lng,data.campus.center.lat],zoom:16,maxZoom:21,pitch:0,attributionControl:{compact:false},canvasContextAttributes:{antialias:true}});
    this.map.addControl(new NavigationControl({visualizePitch:true}),'bottom-right');
    this.map.addControl(new ScaleControl({unit:'metric'}),'bottom-left');
    this.markers=new Map();
    for(const node of data.nodes.filter(node=>node.type==='location')) {
      const element=document.createElement('button');element.type='button';element.className='gl-campus-marker';
      element.title=node.name+' ('+node.id+')';element.setAttribute('aria-label',element.title);
      element.addEventListener('click',event=>{event.stopPropagation();handlers.select(node.id);});
      const marker=new Marker({element,anchor:'center'}).setLngLat([node.lon,node.lat]).addTo(this.map);
      this.markers.set(node.id,{marker,element});
    }
    this.map.on('style.load',()=>this.installLayers());
    this.map.on('error',event=>{
      if(this.destroyed||!this.remote)return;
      if(!this.remoteFailed) {
        this.remoteFailed=true;this.remote=false;this.provider='MapLibre · Campus';
        this.handlers.provider(this.provider);
        this.handlers.notice('Nền OpenFreeMap chưa tải được. Đang dùng bản đồ campus lưu trên máy với đường, hồ và tòa nhà từ OpenStreetMap.');
        this.map.setStyle(localStyle(this.data),{diff:false});
      }
    });
    this.selection(null,null,false);this.fit();
    this.observer=new ResizeObserver(()=>this.map.resize());this.observer.observe(container);
    this.ready=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Không khởi tạo được bản đồ WebGL.')),10000);
      this.map.once('load',()=>{clearTimeout(timer);resolve();});
    });
  }
  async loadBasemap() {
    const controller=new AbortController();this.controller=controller;
    const timer=setTimeout(()=>controller.abort(),10000);
    try {
      const response=await fetch('https://tiles.openfreemap.org/styles/liberty',{signal:controller.signal});
      if(!response.ok)throw new Error('Không tải được style OpenFreeMap.');
      const style=await response.json();if(this.destroyed)return;
      this.remote=true;this.provider='MapLibre · OpenFreeMap';this.handlers.provider(this.provider);
      this.map.setStyle(style,{diff:false});
    } catch {
      if(!this.destroyed)this.handlers.notice('Nền OpenFreeMap chưa tải được. Đang dùng bản đồ campus lưu trên máy với đường, hồ và tòa nhà từ OpenStreetMap.');
    } finally {clearTimeout(timer);}
  }
  installLayers() {
    const map=this.map;if(this.destroyed)return;
    if(map.getSource('campus-buildings'))return;
    map.addSource('campus-buildings',{type:'geojson',data:this.data.buildings});
    map.addLayer({id:'campus-buildings-fill',type:'fill',source:'campus-buildings',paint:{'fill-color':'#d9cdbd','fill-opacity':.75}});
    map.addLayer({id:'campus-buildings-outline',type:'line',source:'campus-buildings',paint:{'line-color':'#ac9b85','line-width':1}});
    map.addLayer({id:'campus-buildings-3d',type:'fill-extrusion',source:'campus-buildings',paint:{'fill-extrusion-color':'#d4c7b3','fill-extrusion-height':['coalesce',['get','height_m'],8],'fill-extrusion-opacity':.9}});
    map.addSource('campus-graph',{type:'geojson',data:collection(this.data.edges.map(edge=>{const a=this.nodes.get(edge.from),b=this.nodes.get(edge.to);return line([[a.lon,a.lat],[b.lon,b.lat]]);} ))});
    map.addLayer({id:'campus-graph',type:'line',source:'campus-graph',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#c2a754','line-width':2,'line-opacity':.55}});
    map.addSource('campus-route',{type:'geojson',data:empty()});
    for(const [id,color,width] of [['route-shadow','#124966',13],['route-border','#fff',9],['route-line','#12b9ee',6]])map.addLayer({id,type:'line',source:'campus-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':color,'line-width':width,'line-opacity':id==='route-shadow'?.5:1}});
    const canvas=document.createElement('canvas');canvas.width=24;canvas.height=24;
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.strokeStyle='#0874a3';context.lineWidth=1.5;
    context.beginPath();context.moveTo(6,5);context.lineTo(18,12);context.lineTo(6,19);context.lineTo(9,12);context.closePath();context.fill();context.stroke();
    map.addImage('route-arrow',context.getImageData(0,0,24,24));
    map.addLayer({id:'route-arrows',type:'symbol',source:'campus-route',layout:{'symbol-placement':'line','symbol-spacing':95,'icon-image':'route-arrow','icon-size':.85,'icon-allow-overlap':true,'icon-keep-upright':false,'icon-rotation-alignment':'map'}});
    map.addSource('device-accuracy',{type:'geojson',data:empty()});
    map.addLayer({id:'device-accuracy-fill',type:'fill',source:'device-accuracy',paint:{'fill-color':'#0891b2','fill-opacity':.1}});
    map.addLayer({id:'device-accuracy-outline',type:'line',source:'device-accuracy',paint:{'line-color':'#0891b2','line-width':1}});
    this.graph(this.visibleGraph);this.buildings(this.visibleBuildings);this.renderMode();
    this.updateRoute();this.userLocation(this.position,{focus:false});
  }
  selection(start,goal,labels=false) {
    this.currentSelection=[start,goal,labels];
    for(const [id,{element}] of this.markers) {
      element.replaceChildren(this.pinContent(this.nodes.get(id),start,goal,labels));
      element.style.zIndex=id===start||id===goal?'1000':'1';
    }
  }
  setVisibility(ids,visible) {for(const id of ids)if(this.map.getLayer(id))this.map.setLayoutProperty(id,'visibility',visible?'visible':'none');}
  graph(visible) {this.visibleGraph=visible;this.setVisibility(['campus-graph'],visible);}
  buildings(visible) {this.visibleBuildings=visible;this.renderMode();}
  renderMode() {
    const threeD=this.mode==='3d';
    this.setVisibility(['campus-buildings-fill','campus-buildings-outline'],this.visibleBuildings&&!threeD);
    this.setVisibility(['campus-buildings-3d'],this.visibleBuildings&&threeD&&!this.remote);
    this.setVisibility(['building-3d'],this.visibleBuildings&&threeD&&this.remote);
    if(this.remote&&threeD)this.setVisibility(['campus-buildings-outline'],this.visibleBuildings);
  }
  mapType(mode) {this.mode=mode;this.renderMode();this.map.easeTo({pitch:mode==='3d'?48:0,bearing:0,duration:500});}
  updateRoute() {
    const coordinates=this.result?.path_coordinates.map(node=>[node.lng,node.lat])||[];
    this.map.getSource('campus-route')?.setData(coordinates.length>1?collection([line(coordinates)]):empty());
  }
  route(result) {
    this.result=result;this.updateRoute();
    const coordinates=result.path_coordinates.map(node=>[node.lng,node.lat]);
    if(coordinates.length>1) {
      const lngs=coordinates.map(p=>p[0]),lats=coordinates.map(p=>p[1]);
      this.map.fitBounds([[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]],{padding:65,maxZoom:19,duration:500});
    } else if(coordinates.length)this.map.easeTo({center:coordinates[0],zoom:18,duration:400});
  }
  clearRoute() {this.result=null;this.updateRoute();}
  userLocation(position,{focus=true}={}) {
    this.position=position;this.gpsMarker?.remove();this.gpsMarker=null;
    const source=this.map.getSource('device-accuracy');if(!position){source?.setData(empty());return;}
    const ring=[],latOffset=position.accuracy/111320,lonOffset=latOffset/Math.cos(position.lat*Math.PI/180);
    for(let i=0;i<=64;i++){const angle=i/64*2*Math.PI;ring.push([position.lng+lonOffset*Math.cos(angle),position.lat+latOffset*Math.sin(angle)]);}
    source?.setData(collection([{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[ring]}}]));
    this.gpsMarker=new Marker({element:this.gpsPin(),anchor:'center'}).setLngLat([position.lng,position.lat]).addTo(this.map);
    if(focus)this.map.easeTo({center:[position.lng,position.lat],zoom:position.accuracy>300?16:18,duration:500});
  }
  fit() {const b=this.data.campus.bounds;this.map.fitBounds([[b.west,b.south],[b.east,b.north]],{padding:45,maxZoom:18,duration:0});}
  destroy() {this.destroyed=true;this.controller?.abort();this.observer.disconnect();this.map.remove();}
}
