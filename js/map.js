const BLUE = '#235ce1';
const ORANGE = '#f28b46';
const SVG_NS = 'http://www.w3.org/2000/svg';
const GPS_COLOR = '#0891b2';
const ROUTE_COLOR = '#12b9ee';

function gpsPin() {
  const element=document.createElement('div');element.className='gps-map-pin';return element;
}

function scriptLoader(src, check, timeoutMs = 12000) {
  if (check()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => { script.remove(); reject(new Error('Bản đồ tải quá thời gian chờ.')); }, timeoutMs);
    script.src = src;
    script.async = true;
    script.onload = () => { clearTimeout(timer); check() ? resolve() : reject(new Error('Không khởi tạo được thư viện bản đồ.')); };
    script.onerror = () => { clearTimeout(timer); reject(new Error('Không tải được thư viện bản đồ.')); };
    document.head.append(script);
  });
}

function loadGoogleMaps(key) {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const finish = error => {
      clearTimeout(timer);
      if (error) { script.remove(); reject(error); }
      else resolve();
    };
    const timer = setTimeout(() => finish(new Error('Google Maps tải quá thời gian chờ.')), 12000);
    window.campusGoogleReady = () => finish();
    window.gm_authFailure = () => finish(new Error('Google Maps API key không hợp lệ.'));
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&v=quarterly&loading=async&libraries=marker&language=vi&region=VN&callback=campusGoogleReady';
    script.async = true;
    script.onerror = () => finish(new Error('Không tải được Google Maps.'));
    document.head.append(script);
  });
}

function pinContent(node, start, goal, labels) {
  const pin = document.createElement('div');
  const selected = node.id === start || node.id === goal;
  pin.className = 'map-pin' + (node.id === start ? ' is-start' : node.id === goal ? ' is-goal' : '');
  if (selected) {
    const letter = document.createElement('span');
    letter.textContent = start === goal ? 'AB' : node.id === start ? 'A' : 'B';
    pin.append(letter);
  }
  if (selected || labels) {
    const label = document.createElement('div');
    label.className = 'map-pin-label' + (!selected ? ' is-node-label' : '');
    label.textContent = selected ? node.name : node.id;
    pin.append(label);
  }
  return pin;
}

class LeafletMap {
  constructor(container, data, handlers) {
    const L = window.L;
    this.provider = 'Leaflet · OpenStreetMap';
    this.data = data;
    this.handlers = handlers;
    this.nodes = new Map(data.nodes.map(node => [node.id, node]));
    this.map = L.map(container, {zoomControl: false, maxZoom: 21});
    L.control.zoom({position: 'bottomright'}).addTo(this.map);
    L.control.scale({imperial: false, position: 'bottomleft'}).addTo(this.map);
    this.tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxNativeZoom: 19, maxZoom: 21,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);
    let errors = 0, loaded = 0, warned = false;
    this.tiles.on('tileload', () => {
      loaded++;
      if (warned) { warned = false; handlers.notice(''); }
    });
    this.tiles.on('tileerror', () => {
      if (++errors >= 4 && loaded === 0 && !warned) {
        warned = true;
        handlers.notice('Chưa tải được ảnh nền OpenStreetMap. Tòa nhà, địa điểm và tuyến đường vẫn hiển thị; hãy kiểm tra Internet rồi tải lại trang.');
      }
    });
    this.edgeLayer = L.layerGroup().addTo(this.map);
    this.routeLayer = L.layerGroup().addTo(this.map);
    this.arrowLayer=L.layerGroup().addTo(this.map);this.routePoints=[];
    this.map.on('zoomend moveend',()=>this.drawArrows());
    this.gpsLayer = L.layerGroup().addTo(this.map);
    this.map.createPane('buildingFootprints').style.zIndex='350';
    this.map.createPane('campusBase').style.zIndex='300';
    L.geoJSON(data.basemap,{pane:'campusBase',interactive:false,style:feature=>({
      color:feature.properties.kind==='road'?'#fffdf6':feature.properties.kind==='water'?'#85bccd':'#cbd5bd',
      weight:feature.properties.kind==='road'?5:1,fillColor:feature.properties.kind==='water'?'#a7d9e8':feature.properties.kind==='sport'?'#bbd5aa':'#e8eddf',fillOpacity:.45,
    })}).addTo(this.map);
    this.buildingLayer = L.geoJSON(data.buildings, {
      pane:'buildingFootprints',
      style:{color:'#ac9d88',weight:1.3,fillColor:'#e2d5c3',fillOpacity:.8},
      onEachFeature:(feature,layer)=>{
        const label=document.createElement('span');label.textContent=feature.properties.name;
        layer.bindTooltip(label,{direction:'top'});
      },
    }).addTo(this.map);
    for (const edge of data.edges) {
      const a = this.nodes.get(edge.from), b = this.nodes.get(edge.to);
      L.polyline([[a.lat, a.lon], [b.lat, b.lon]], {color: '#b69536', weight: 2, opacity: .55,interactive:false})
        .addTo(this.edgeLayer);
    }
    this.markers = new Map();
    for (const node of data.nodes.filter(node => node.type === 'location')) {
      const tooltip = document.createElement('span');
      tooltip.textContent = node.name + ' · ' + node.id;
      const marker = L.marker([node.lat, node.lon], {title: node.name + ' (' + node.id + ')', keyboard: true})
        .bindTooltip(tooltip, {direction: 'top', offset: [0, -8]})
        .on('click', () => handlers.select(node.id)).addTo(this.map);
      this.markers.set(node.id, marker);
    }
    this.selection(null, null, false);
    this.fit();
    this.observer = new ResizeObserver(() => this.map.invalidateSize());
    this.observer.observe(container);
  }
  selection(start, goal, labels = false) {
    for (const [id, marker] of this.markers) {
      const selected = id === start || id === goal;
      const size = selected ? 23 : 13;
      marker.setIcon(window.L.divIcon({
        className: 'campus-marker', html: pinContent(this.nodes.get(id), start, goal, labels),
        iconSize: [size, size], iconAnchor: [size / 2, size / 2],
      }));
      marker.setZIndexOffset(selected ? 1000 : 0);
    }
  }
  graph(visible) {
    visible ? this.edgeLayer.addTo(this.map) : this.edgeLayer.remove();
  }
  buildings(visible) { visible ? this.buildingLayer.addTo(this.map) : this.buildingLayer.remove(); }
  userLocation(position,{focus=true}={}) {
    this.gpsLayer.clearLayers();if(!position)return;
    const center=[position.lat,position.lng];
    window.L.circle(center,{radius:position.accuracy,color:GPS_COLOR,weight:1,fillColor:GPS_COLOR,fillOpacity:.1,interactive:false}).addTo(this.gpsLayer);
    window.L.marker(center,{icon:window.L.divIcon({className:'campus-marker',html:gpsPin(),iconSize:[18,18],iconAnchor:[9,9]}),title:'Vị trí của bạn',keyboard:false,zIndexOffset:2000}).addTo(this.gpsLayer);
    if(focus)this.map.setView(center,position.accuracy>300?16:18);
  }
  clearRoute() { this.routePoints=[];this.routeLayer.clearLayers();this.arrowLayer.clearLayers(); }
  drawArrows() {
    this.arrowLayer.clearLayers();
    for(let i=1;i<this.routePoints.length;i++) {
      const a=this.map.latLngToLayerPoint(this.routePoints[i-1]),b=this.map.latLngToLayerPoint(this.routePoints[i]);
      const length=a.distanceTo(b);if(length<80)continue;
      const count=Math.max(1,Math.floor(length/110));
      for(let j=0;j<count;j++) {
        const fraction=(j+.5)/count,point=window.L.point(a.x+(b.x-a.x)*fraction,a.y+(b.y-a.y)*fraction);
        const arrow=svgElement('svg',{width:18,height:18,viewBox:'0 0 18 18',class:'route-direction'});
        arrow.style.transform='rotate('+Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+'deg)';
        arrow.append(svgElement('path',{d:'M4 3L14 9 4 15 7 9Z',fill:'#fff',stroke:'#0874a3','stroke-width':1}));
        window.L.marker(this.map.layerPointToLatLng(point),{interactive:false,keyboard:false,icon:window.L.divIcon({className:'route-arrow-marker',html:arrow,iconSize:[18,18],iconAnchor:[9,9]})}).addTo(this.arrowLayer);
      }
    }
  }
  route(result) {
    this.clearRoute();
    const points = result.path_coordinates.map(node => [node.lat, node.lng]);
    if (points.length > 1) {
      window.L.polyline(points, {color: '#073e5a', weight: 13, opacity: .6,interactive:false}).addTo(this.routeLayer);
      window.L.polyline(points, {color: '#fff', weight: 9, opacity: 1,interactive:false}).addTo(this.routeLayer);
      window.L.polyline(points, {color: ROUTE_COLOR, weight: 6, opacity: 1,interactive:false}).addTo(this.routeLayer);
      this.routePoints=points;
      this.map.fitBounds(points, {padding: [50, 65], maxZoom: 19});
      this.drawArrows();
    } else if (points.length) this.map.setView(points[0], 18);
  }
  fit() {
    const b = this.data.campus.bounds;
    this.map.fitBounds([[b.south, b.west], [b.north, b.east]], {padding: [35, 35], maxZoom: 18});
  }
  mapType() {}
  destroy() { this.observer.disconnect(); this.map.remove(); }
}

class GoogleMap {
  constructor(container, data, config, handlers, libraries) {
    this.provider = 'Google Maps';
    this.data = data;
    this.handlers = handlers;
    this.nodes = new Map(data.nodes.map(node => [node.id, node]));
    this.AdvancedMarkerElement=libraries.AdvancedMarkerElement;
    this.gpsMarker=null;this.gpsCircle=null;
    this.map = new libraries.Map(container, {
      center: data.campus.center, zoom: 17, mapId: config.google_maps_map_id,
      disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy',
      zoomControlOptions: {position: window.google.maps.ControlPosition.RIGHT_BOTTOM},
      clickableIcons: false,mapTypeId:'hybrid',tilt:0,
    });
    this.buildingPolygons=data.buildings.features.map(feature=>new window.google.maps.Polygon({
      map:this.map,paths:feature.geometry.coordinates.map(ring=>ring.map(([lng,lat])=>({lat,lng}))),
      strokeColor:'#ffffff',strokeWeight:1,strokeOpacity:.7,fillColor:'#ffffff',fillOpacity:.04,clickable:false,zIndex:1,
    }));
    this.edges = data.edges.map(edge => {
      const a = this.nodes.get(edge.from), b = this.nodes.get(edge.to);
      return new window.google.maps.Polyline({
        map: this.map, path: [{lat:a.lat,lng:a.lon}, {lat:b.lat,lng:b.lon}],
        strokeColor:'#facc15', strokeOpacity:.8, strokeWeight:2, clickable:false,zIndex:2,
      });
    });
    this.markers = new Map();
    for (const node of data.nodes.filter(node => node.type === 'location')) {
      const marker = new libraries.AdvancedMarkerElement({
        map: this.map, position: {lat:node.lat,lng:node.lon}, title: node.name + ' (' + node.id + ')',
        gmpClickable: true, anchorLeft:'-50%',anchorTop:'-50%',
      });
      marker.append(pinContent(node, null, null, false));
      marker.addEventListener('gmp-click', () => handlers.select(node.id));
      this.markers.set(node.id, marker);
    }
    this.routeLines = [];
    this.fit();
  }
  selection(start, goal, labels = false) {
    for (const [id, marker] of this.markers) {
      marker.replaceChildren(pinContent(this.nodes.get(id), start, goal, labels));
      marker.zIndex = id === start || id === goal ? 1000 : 0;
    }
  }
  graph(visible) { this.edges.forEach(line => line.setMap(visible ? this.map : null)); }
  buildings(visible) { this.buildingPolygons.forEach(polygon=>polygon.setMap(visible?this.map:null)); }
  userLocation(position,{focus=true}={}) {
    if(this.gpsMarker)this.gpsMarker.map=null;
    this.gpsCircle?.setMap(null);this.gpsMarker=null;this.gpsCircle=null;
    if(!position)return;
    const center={lat:position.lat,lng:position.lng};
    this.gpsCircle=new window.google.maps.Circle({map:this.map,center,radius:position.accuracy,strokeColor:GPS_COLOR,strokeWeight:1,fillColor:GPS_COLOR,fillOpacity:.1,clickable:false,zIndex:3});
    this.gpsMarker=new this.AdvancedMarkerElement({map:this.map,position:center,title:'Vị trí của bạn',anchorLeft:'-50%',anchorTop:'-50%',zIndex:2000});
    this.gpsMarker.append(gpsPin());
    if(focus){this.map.setCenter(center);this.map.setZoom(position.accuracy>300?16:18);}
  }
  clearRoute() { this.routeLines.forEach(line => line.setMap(null)); this.routeLines = []; }
  route(result) {
    this.clearRoute();
    const path = result.path_coordinates.map(point => ({lat:point.lat,lng:point.lng}));
    if (path.length > 1) {
      for (const [index,[color, weight]] of [['#073e5a',13],['#ffffff', 9], [ROUTE_COLOR, 6]].entries()) {
        this.routeLines.push(new window.google.maps.Polyline({map:this.map,path,strokeColor:color,strokeWeight:weight,strokeOpacity:1,clickable:false,zIndex:10+index}));
      }
      this.routeLines.push(new window.google.maps.Polyline({map:this.map,path,strokeOpacity:0,clickable:false,zIndex:14,
        icons:[{icon:{path:window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,scale:2.5,fillColor:'#ffffff',fillOpacity:1,strokeColor:'#0874a3',strokeWeight:1},offset:'45px',repeat:'95px'}]}));
      const bounds = new window.google.maps.LatLngBounds();
      path.forEach(point => bounds.extend(point));
      this.map.fitBounds(bounds, 65);
    } else if (path.length) { this.map.setCenter(path[0]); this.map.setZoom(18); }
  }
  fit() { this.map.fitBounds(this.data.campus.bounds, 35); }
  mapType(type) {
    this.map.setMapTypeId(type);
    const satellite=type==='hybrid'||type==='satellite';
    this.buildingPolygons.forEach(polygon=>polygon.setOptions({strokeColor:satellite?'#ffffff':'#ac9d88',fillColor:satellite?'#ffffff':'#e2d5c3',fillOpacity:satellite?.04:.8}));
    this.edges.forEach(line=>line.setOptions({strokeColor:satellite?'#facc15':'#b69536',strokeOpacity:satellite?.8:.55}));
  }
  destroy() {
    this.clearRoute();this.edges.forEach(line=>line.setMap(null));this.markers.forEach(marker=>{marker.map=null;});
    this.buildings(false);this.userLocation(null,{focus:false});
    window.google.maps.event.clearInstanceListeners(this.map);
  }
}

function svgElement(tag, attributes = {}, text) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (text !== undefined) element.textContent = text;
  return element;
}

class DiagramMap {
  constructor(container, data, handlers) {
    this.provider = 'Sơ đồ tọa độ';
    this.data = data;
    this.handlers = handlers;
    const lat = data.campus.center.lat;
    const lonScale = 111320 * Math.cos(lat * Math.PI / 180);
    this.project=(latitude,longitude)=>[(longitude-data.campus.center.lng)*lonScale,(lat-latitude)*111320];
    this.points = new Map(data.nodes.map(node => [node.id,this.project(node.lat,node.lon)]));
    const xs = [...this.points.values()].map(p=>p[0]), ys = [...this.points.values()].map(p=>p[1]);
    this.defaultBox = [Math.min(...xs)-80, Math.min(...ys)-70, Math.max(...xs)-Math.min(...xs)+160, Math.max(...ys)-Math.min(...ys)+140];
    this.box = [...this.defaultBox];
    this.svg = svgElement('svg', {class:'diagram-map', 'aria-label':'Sơ đồ tọa độ campus', role:'group'});
    const defs = svgElement('defs');
    const pattern = svgElement('pattern',{id:'campus-grid',width:100,height:100,patternUnits:'userSpaceOnUse'});
    pattern.append(svgElement('path',{d:'M 100 0 L 0 0 0 100',fill:'none',stroke:'#dbe4df','stroke-width':1}));
    defs.append(pattern);
    this.svg.append(defs, svgElement('rect',{x:-10000,y:-10000,width:20000,height:20000,fill:'url(#campus-grid)'}));
    this.edgeLayer = svgElement('g',{'stroke-linecap':'round'});
    this.buildingLayer = svgElement('g',{'aria-label':'Đường bao tòa nhà'});
    this.routeLayer = svgElement('g');
    this.markerLayer = svgElement('g');
    this.gpsLayer=svgElement('g',{'pointer-events':'none'});
    this.svg.append(this.buildingLayer,this.edgeLayer, this.routeLayer, this.markerLayer,this.gpsLayer);
    container.replaceChildren(this.svg);
    for(const feature of data.buildings.features) {
      const points=feature.geometry.coordinates[0].map(([lng,lat])=>this.project(lat,lng).join(',')).join(' ');
      const polygon=svgElement('polygon',{points,fill:'#e2d5c3',stroke:'#ac9d88','stroke-width':1.3,'vector-effect':'non-scaling-stroke','data-building-id':feature.id});
      polygon.append(svgElement('title',{},feature.properties.name));this.buildingLayer.append(polygon);
    }
    for (const edge of data.edges) {
      const a = this.points.get(edge.from), b = this.points.get(edge.to);
      this.edgeLayer.append(svgElement('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#fff','stroke-width':4,'vector-effect':'non-scaling-stroke'}),
        svgElement('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#a9bbb5','stroke-opacity':.6,'stroke-width':1.5,'vector-effect':'non-scaling-stroke'}));
    }
    this.annotationLayer = svgElement('g',{'pointer-events':'none'});
    this.svg.append(this.annotationLayer);
    this.selection(null, null, false);
    this.fit();
    const zoom = document.createElement('div');
    this.zoomControls = zoom;
    zoom.className = 'diagram-zoom';
    for (const [label, factor, aria] of [['+',.8,'Phóng to'],['−',1.25,'Thu nhỏ']]) {
      const button = document.createElement('button');
      button.type='button'; button.textContent=label; button.setAttribute('aria-label',aria);
      button.addEventListener('click',()=>this.zoom(factor));
      zoom.append(button);
    }
    container.append(zoom);
    this.svg.addEventListener('wheel', event => { event.preventDefault(); this.zoom(event.deltaY < 0 ? .85 : 1.18); }, {passive:false});
    let drag = null;
    this.svg.addEventListener('pointerdown', event => {
      if (event.target.closest('.diagram-location')) return;
      drag = {x:event.clientX,y:event.clientY,box:[...this.box]};
      this.svg.setPointerCapture(event.pointerId);
    });
    this.svg.addEventListener('pointermove', event => {
      if (!drag) return;
      const rect = this.svg.getBoundingClientRect();
      const ratio = Math.max(this.box[2] / rect.width, this.box[3] / rect.height);
      this.box[0] = drag.box[0] - (event.clientX-drag.x)*ratio;
      this.box[1] = drag.box[1] - (event.clientY-drag.y)*ratio;
      this.applyBox();
    });
    for (const type of ['pointerup','pointercancel']) this.svg.addEventListener(type,()=>{drag=null;});
    this.observer = new ResizeObserver(() => {
      this.selection(...this.currentSelection);
      this.updateAnnotations();
      this.renderGps();
    });
    this.observer.observe(container);
  }
  unitsPerPixel() {
    const rect=this.svg.getBoundingClientRect();
    return Math.max(this.box[2]/Math.max(1,rect.width),this.box[3]/Math.max(1,rect.height));
  }
  updateAnnotations() {
    const units=this.unitsPerPixel();
    this.annotationLayer.replaceChildren();
    const scale=svgElement('g',{transform:'translate('+(this.box[0]+20*units)+','+(this.box[1]+this.box[3]-18*units)+')'});
    scale.append(svgElement('path',{d:'M0 '+(-5*units)+'V0H100V'+(-5*units),fill:'none',stroke:'#607c72','stroke-width':1.5,'vector-effect':'non-scaling-stroke'}),
      svgElement('text',{x:50,y:-10*units,'text-anchor':'middle',fill:'#607c72','font-size':10*units,stroke:'none'},'100 m'));
    const north=svgElement('g',{transform:'translate('+(this.box[0]+this.box[2]-27*units)+','+(this.box[1]+75*units)+') scale('+units+')'});
    north.append(svgElement('text',{y:-12,'text-anchor':'middle',fill:'#607c72','font-size':11,'font-weight':600,stroke:'none'},'N'),
      svgElement('path',{d:'M0 14V-2M-3 2L0-2 3 2',fill:'none',stroke:'#607c72','stroke-width':1.5}));
    this.annotationLayer.append(scale,north);
  }
  applyBox() {
    this.svg.setAttribute('viewBox',this.box.join(' '));
    this.selection(...this.currentSelection);
    this.updateAnnotations();
    this.renderGps();
  }
  zoom(factor) {
    const width = Math.min(this.defaultBox[2]*2,Math.max(this.defaultBox[2]/5,this.box[2]*factor));
    const ratio = width/this.box[2];
    this.box = [this.box[0]+(this.box[2]-width)/2,this.box[1]+this.box[3]*(1-ratio)/2,width,this.box[3]*ratio];
    this.applyBox();
  }
  selection(start, goal, labels = false) {
    this.currentSelection=[start,goal,labels];
    const units=this.unitsPerPixel();
    this.markerLayer.replaceChildren();
    for (const node of this.data.nodes.filter(n=>n.type==='location')) {
      const p = this.points.get(node.id), selected = node.id === start || node.id === goal;
      const color = node.id === start ? BLUE : node.id === goal ? ORANGE : '#6487b6';
      const group = svgElement('g',{class:'diagram-location',transform:'translate('+p[0]+','+p[1]+') scale('+units+')'});
      group.append(svgElement('title',{},node.name+' · '+node.id));
      if (selected) group.append(svgElement('circle',{r:16,fill:color,'fill-opacity':.15,stroke:color,'stroke-width':1}));
      group.append(svgElement('circle',{r:selected?10:6,fill:color,stroke:'white','stroke-width':2}));
      if (selected) group.append(svgElement('text',{y:4,'text-anchor':'middle',fill:'white','font-size':11,'font-weight':700,stroke:'none'}, start===goal?'AB':node.id===start?'A':'B'));
      const label = selected ? (node.name.length>30 ? node.name.slice(0,27)+'…' : node.name) : node.id;
      if (labels || selected) group.append(svgElement('text',{x:selected?0:10,y:selected?-22:-13,'text-anchor':selected?'middle':'start',fill:color,'font-size':selected?11:9,'font-weight':600,stroke:'none'},label));
      group.append(svgElement('circle',{r:15,fill:'transparent',stroke:'none',tabindex:0,role:'button','aria-label':node.name+' ('+node.id+')'}));
      group.addEventListener('click',()=>this.handlers.select(node.id));
      group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();this.handlers.select(node.id);}});
      this.markerLayer.append(group);
    }
  }
  graph(visible) { this.edgeLayer.style.display=visible?'':'none'; }
  buildings(visible) { this.buildingLayer.style.display=visible?'':'none'; }
  userLocation(position,{focus=true}={}) {
    this.userPosition=position;
    if(position&&focus) {
      const p=this.project(position.lat,position.lng);
      this.box=[p[0]-this.defaultBox[2]/2,p[1]-this.defaultBox[3]/2,...this.defaultBox.slice(2)];
      this.applyBox();
    } else this.renderGps();
  }
  renderGps() {
    this.gpsLayer.replaceChildren();if(!this.userPosition)return;
    const p=this.project(this.userPosition.lat,this.userPosition.lng),units=this.unitsPerPixel();
    this.gpsLayer.append(svgElement('circle',{cx:p[0],cy:p[1],r:this.userPosition.accuracy,fill:GPS_COLOR,'fill-opacity':.1,stroke:GPS_COLOR,'stroke-width':1,'vector-effect':'non-scaling-stroke'}));
    const marker=svgElement('g',{transform:'translate('+p[0]+','+p[1]+') scale('+units+')'});
    marker.append(svgElement('circle',{r:8,fill:GPS_COLOR,stroke:'white','stroke-width':3}),svgElement('text',{y:-20,'text-anchor':'middle',fill:GPS_COLOR,'font-size':11,'font-weight':600,stroke:'white','stroke-width':3,'paint-order':'stroke fill'},'Vị trí của bạn'));
    this.gpsLayer.append(marker);
  }
  clearRoute() { this.routeLayer.replaceChildren(); }
  route(result) {
    this.clearRoute();
    if (result.path.length > 1) {
      const points = result.path.map(id=>this.points.get(id).join(',')).join(' ');
      for (const [color,width] of [['white',11],[BLUE,7]]) this.routeLayer.append(svgElement('polyline',{points,fill:'none',stroke:color,'stroke-width':width,'stroke-linecap':'round','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'}));
    }
  }
  fit() { this.box=[...this.defaultBox];this.applyBox(); }
  mapType() {}
  destroy() { this.observer.disconnect();this.svg.remove();this.zoomControls.remove(); }
}

export async function createCampusMap(container, data, config, handlers) {
  let adapter = null, selection = [null,null,false], visibleGraph = true, visibleBuildings=true, result = null,position=null;
  let googleNotice = '';
  const facade = {
    get provider() { return adapter?.provider || 'Đang tải'; },
    selection(...values) { selection=values;adapter?.selection(...values); },
    graph(value) { visibleGraph=value;adapter?.graph(value); },
    buildings(value) { visibleBuildings=value;adapter?.buildings(value); },
    userLocation(value,options) { position=value;adapter?.userLocation(value,options); },
    clearRoute() { result=null;adapter?.clearRoute(); },
    route(value) { result=value;adapter?.route(value); },
    fit() { adapter?.fit(); },
    mapType(type) { adapter?.mapType(type); },
  };
  const install = next => {
    adapter=next;adapter.selection(...selection);adapter.graph(visibleGraph);
    adapter.buildings(visibleBuildings);if(position)adapter.userLocation(position,{focus:false});
    if(result)adapter.route(result);
    handlers.provider?.(adapter.provider);
  };
  const useDiagram = () => {
    if(adapter?.provider==='Sơ đồ tọa độ')return;
    try { adapter?.destroy(); } catch { /* A rejected SDK map may already be detached. */ }
    adapter=null;container.replaceChildren();
    install(new DiagramMap(container,data,handlers));
    handlers.notice('Đang dùng sơ đồ tọa độ. Nền bản đồ online chưa tải được; tìm đường vẫn hoạt động.');
  };
  const useLeaflet = async () => {
    try { adapter?.destroy(); } catch { /* Keep the fallback usable after an auth failure. */ }
    adapter=null;container.replaceChildren();
    try {
      await scriptLoader('/vendor/leaflet/leaflet.js',()=>Boolean(window.L));
      install(new LeafletMap(container,data,{...handlers,notice:message=>handlers.notice([googleNotice,message].filter(Boolean).join(' '))}));
      if (googleNotice) handlers.notice(googleNotice);
    } catch { useDiagram(); }
  };
  if(config.map_provider==='openfreemap') {
    let openMap;
    try {
      const {OpenMap}=await import('./open_map.js');
      openMap=new OpenMap(container,data,handlers,pinContent,gpsPin);
      await openMap.ready;install(openMap);void openMap.loadBasemap();return facade;
    } catch {
      openMap?.destroy();container.replaceChildren();
      handlers.notice('Thiết bị chưa hỗ trợ bản đồ WebGL. Đang dùng Leaflet với dữ liệu campus.');
    }
  }
  if (config.map_provider === 'google' && config.google_maps_api_key) {
    try {
      await loadGoogleMaps(config.google_maps_api_key);
      const [maps,markers] = await Promise.all([window.google.maps.importLibrary('maps'),window.google.maps.importLibrary('marker')]);
      install(new GoogleMap(container,data,config,handlers,{...maps,...markers}));
      window.gm_authFailure = () => {
        googleNotice='Google Maps chưa xác thực được. Đang dùng Leaflet; hãy kiểm tra thiết lập Maps Platform và Billing.';
        handlers.notice(googleNotice);
        void useLeaflet();
      };
      return facade;
    } catch (error) {
      console.warn('Không khởi tạo được Google Maps:',String(error?.message||error).replace(/AIza[\w-]+/g,'[API key ẩn]'));
      googleNotice='Google Maps chưa sẵn sàng. Đang dùng bản đồ thay thế. Kiểm tra API key và Billing.';
      handlers.notice(googleNotice);
    }
  }
  await useLeaflet();
  return facade;
}
