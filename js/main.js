import {requestJSON} from './api.js';
import {createCampusMap} from './map.js';
import {getDevicePosition, nearestLocation} from './location.js';

const $ = id => document.getElementById(id);
const normalize = text => text.toLocaleLowerCase('vi').replaceAll('đ','d').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const state = {data:null,map:null,result:null,target:'start',controller:null,revision:0,ready:false,busy:false,position:null,nearest:null,gpsRevision:0};

class LocationPicker {
  constructor(prefix, changed) {
    this.prefix=prefix;this.input=$(prefix+'Input');this.list=$(prefix+'Options');this.root=$(prefix+'Picker');
    this.nodes=[];this.filtered=[];this.id=null;this.highlight=-1;this.changed=changed;
    this.input.addEventListener('focus',()=>this.open());
    this.input.addEventListener('click',()=>this.open());
    this.input.addEventListener('input',()=>{
      this.id=null;this.input.removeAttribute('aria-invalid');
      this.render(this.input.value);this.open(false);this.changed();
    });
    this.input.addEventListener('keydown',event=>this.keydown(event));
    document.addEventListener('pointerdown',event=>{if(!this.root.contains(event.target))this.close();});
  }
  setNodes(nodes) { this.nodes=nodes;this.input.disabled=false;this.render(''); }
  open(reset=true) {
    if(this.input.disabled)return;
    if(reset)this.render(this.id?'':this.input.value);
    this.list.hidden=false;this.input.setAttribute('aria-expanded','true');
  }
  close() {
    this.list.hidden=true;this.highlight=-1;
    this.input.setAttribute('aria-expanded','false');this.input.removeAttribute('aria-activedescendant');
  }
  render(query) {
    const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
    this.filtered=this.nodes.filter(node=>terms.every(term=>normalize(node.name+' '+node.id).includes(term)));
    this.list.replaceChildren();this.highlight=-1;
    for(const node of this.filtered) {
      const option=document.createElement('div');option.className='picker-option';option.id=this.prefix+'-option-'+node.id;
      option.setAttribute('role','option');option.setAttribute('aria-selected',String(node.id===this.id));
      const name=document.createElement('span');name.textContent=node.name;
      const code=document.createElement('span');code.textContent=node.id;
      option.append(name,code);
      option.addEventListener('pointerdown',event=>event.preventDefault());
      option.addEventListener('click',()=>this.set(node.id));
      this.list.append(option);
    }
    if(!this.filtered.length) {
      const empty=document.createElement('div');empty.className='picker-no-match';empty.textContent='Không tìm thấy địa điểm phù hợp.';
      this.list.append(empty);
    }
  }
  keydown(event) {
    if(event.key==='ArrowDown'||event.key==='ArrowUp') {
      event.preventDefault();if(this.list.hidden)this.open();
      if(!this.filtered.length)return;
      this.highlight=(this.highlight+(event.key==='ArrowDown'?1:-1)+this.filtered.length)%this.filtered.length;
      [...this.list.children].forEach((option,index)=>option.classList.toggle('is-highlighted',index===this.highlight));
      const active=this.list.children[this.highlight];this.input.setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'});
    } else if(event.key==='Enter'&&!this.list.hidden) {
      event.preventDefault();
      if(this.highlight>=0)this.set(this.filtered[this.highlight].id);
      else if(this.filtered.length===1)this.set(this.filtered[0].id);
      else if(this.id)this.close();
    } else if(event.key==='Escape') {event.preventDefault();this.close();}
  }
  set(id, silent=false) {
    const node=this.nodes.find(node=>node.id===id);
    this.id=node?.id||null;this.input.value=node?node.name+' · '+node.id:'';
    this.input.removeAttribute('aria-invalid');this.close();if(!silent)this.changed();
  }
  resolve(label) {
    if(this.id)return this.id;
    const typed=this.input.value.trim();
    const matches=this.nodes.filter(node=>node.id.toUpperCase()===typed.toUpperCase()||node.name===typed);
    if(matches.length===1){this.set(matches[0].id,true);return this.id;}
    this.input.setAttribute('aria-invalid','true');
    this.input.focus();
    throw new Error(typed?'Hãy chọn '+label+' hợp lệ từ danh sách địa điểm.':'Hãy chọn '+label+'.');
  }
}
const startPicker=new LocationPicker('start',inputsChanged);
const goalPicker=new LocationPicker('goal',inputsChanged);

function setStatus(text,type='') { $('status').textContent=text;$('status').className='form-status'+(type?' is-'+type:''); }
function notice(text) { $('mapNotice').textContent=text;$('mapNotice').hidden=!text; }
function providerChanged(provider) {
  const google=provider==='Google Maps',openMap=provider.startsWith('MapLibre');
  $('providerBadge').textContent=provider;
  $('aboutMap').textContent=google?'Google Maps theo cấu hình của server.':openMap?'OpenFreeMap + MapLibre: miễn phí, không cần tài khoản hoặc key. Tòa nhà 3D là khối minh họa; khi thiếu chiều cao, bản campus dùng 8 m.':'Leaflet + dữ liệu OpenStreetMap lưu trên máy; không cần API key.';
  document.querySelector('.map-view-switch').hidden=!google&&!openMap;
  $('satelliteButton').hidden=!google;$('satelliteButton').disabled=!google;
  $('threeDButton').hidden=!openMap;
  const threeD=openMap&&$('threeDButton').classList.contains('is-active');
  $('roadmapButton').classList.toggle('is-active',!google&&!threeD);
  $('satelliteButton').classList.toggle('is-active',google);
  $('roadmapButton').textContent=openMap?'2D':'Bản đồ';
  if(google)$('satelliteButton').removeAttribute('title');
}
function gpsStatus(text,error=false) {
  $('gpsStatus').textContent=text;$('gpsStatus').classList.toggle('is-error',error);
}
async function locateDevice() {
  if(!state.ready)return;
  const revision=++state.gpsRevision;
  state.position=null;state.nearest=null;$('useGpsStartButton').hidden=true;state.map?.userLocation(null,{focus:false});
  $('locateButton').disabled=true;$('locateButtonText').textContent='Đang lấy vị trí…';
  gpsStatus('Hãy cho phép quyền Vị trí khi trình duyệt hỏi.');
  try {
    const position=await getDevicePosition(navigator.geolocation,window.isSecureContext);
    if(revision!==state.gpsRevision)return;
    state.position=position;state.nearest=nearestLocation(position,state.data.nodes);
    state.map?.userLocation(position,{focus:state.map.provider!=='Sơ đồ tọa độ'||state.nearest.reason!=='outside_campus'});
    const accuracy='Sai số thiết bị báo: ±'+Math.round(position.accuracy)+' m.';
    $('useGpsStartButton').hidden=!state.nearest.eligible;
    if(state.nearest.reason==='outside_campus')gpsStatus(accuracy+' Bạn chưa ở gần địa điểm trong campus. Không tự chọn điểm đầu.');
    else if(state.nearest.reason==='low_accuracy')gpsStatus(accuracy+' Vị trí còn quá rộng để gợi ý điểm đầu. Hãy thử lại hoặc chọn thủ công.');
    else if(state.nearest.eligible)gpsStatus(accuracy+' Gần '+state.nearest.node.name+' (khoảng '+Math.round(state.nearest.distance)+' m).');
    else gpsStatus(accuracy+' Chưa có địa điểm phù hợp.');
  } catch(error) {
    if(revision===state.gpsRevision)gpsStatus(error.message,true);
  } finally {
    if(revision===state.gpsRevision){$('locateButton').disabled=false;$('locateButtonText').textContent='Lấy vị trí hiện tại';}
  }
}
function algorithm() { return document.querySelector('input[name="algorithm"]:checked').value; }
function setBusy(busy) {
  state.busy=busy;document.body.classList.toggle('is-loading',busy);
  $('findButton').disabled=busy||!state.ready;$('findButtonText').textContent=busy?'Đang tính lộ trình…':'Tìm đường';
}
function clearResult() {
  state.result=null;$('resultEmpty').hidden=false;$('resultContent').hidden=true;$('routeList').replaceChildren();
  for(const id of ['distance','visited','time','pathCount'])$(id).textContent='—';
  state.map?.clearRoute();
}
function inputsChanged() {
  state.revision++;state.controller?.abort();state.controller=null;setBusy(false);clearResult();
  state.map?.selection(startPicker.id,goalPicker.id,$('showLabels').checked);
  if(state.ready)setStatus('Sẵn sàng. Bấm Tìm đường để xem lộ trình.');
}
function setTarget(target) {
  state.target=target;
  for(const [id,value] of [['selectStartButton','start'],['selectGoalButton','goal']]) {
    $(id).classList.toggle('is-active',target===value);$(id).setAttribute('aria-pressed',String(target===value));
  }
}
function selectOnMap(id) {
  if(state.target==='start'){startPicker.set(id);setTarget('goal');}
  else goalPicker.set(id);
}
function renderRouteList() {
  const list=$('routeList');list.replaceChildren();
  if(!state.result)return;
  const nodes=new Map(state.data.nodes.map(node=>[node.id,node]));
  const stops=state.result.path.map(id=>nodes.get(id)).filter(node=>$('showWaypoints').checked||node.type==='location');
  if(!stops.length) {
    const item=document.createElement('li');item.textContent='Không có đường nối hai địa điểm trong dữ liệu hiện tại.';item.className='route-stop-name';
    list.append(item);return;
  }
  for(const [index,node] of stops.entries()) {
    const item=document.createElement('li');item.classList.toggle('is-waypoint',node.type==='waypoint');
    const dot=document.createElement('span');dot.className='route-step-dot';dot.textContent=node.type==='waypoint'?'':index===0?'A':index===stops.length-1?'B':String(index+1);
    const copy=document.createElement('div'),name=document.createElement('span'),code=document.createElement('span');
    name.className='route-stop-name';name.textContent=node.type==='waypoint'?'Điểm trung gian':node.name;
    code.className='route-stop-id';code.textContent=node.id;copy.append(name,code);item.append(dot,copy);list.append(item);
  }
}
function displayResult(result) {
  state.result=result;$('resultEmpty').hidden=true;$('resultContent').hidden=false;
  $('resultAlgorithm').textContent=result.algorithm;
  $('resultState').textContent=result.found?(result.start===result.goal?'Bạn đã ở điểm đến':'Đã tìm thấy lộ trình'):'Không tìm thấy đường';
  $('resultState').parentElement.classList.toggle('is-error',!result.found);
  $('distance').textContent=result.found?new Intl.NumberFormat('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(result.distance)+' m':'—';
  $('visited').textContent=result.visited_nodes;
  $('time').textContent=new Intl.NumberFormat('vi-VN',{minimumFractionDigits:3,maximumFractionDigits:3}).format(result.execution_time*1000)+' ms';
  $('pathCount').textContent=result.path.length+' node';
  renderRouteList();state.map?.selection(result.start,result.goal,$('showLabels').checked);state.map?.route(result);
  setStatus(result.found?(result.start===result.goal?'Điểm đầu trùng điểm đến. Bạn không cần di chuyển.':'Đã tìm thấy lộ trình bằng '+result.algorithm+'.'):'Không có đường nối hai địa điểm trong dữ liệu hiện tại.',result.found?'success':'error');
}
async function findRoute(event) {
  event?.preventDefault();if(!state.ready||state.busy)return;
  let start,goal;
  try { start=startPicker.resolve('điểm bắt đầu');goal=goalPicker.resolve('điểm đến'); }
  catch(error){setStatus(error.message,'error');return;}
  startPicker.close();goalPicker.close();clearResult();
  state.controller?.abort();const controller=new AbortController();state.controller=controller;
  const revision=++state.revision;let timedOut=false;
  const timeout=setTimeout(()=>{timedOut=true;controller.abort();},12000);
  state.map?.selection(start,goal,$('showLabels').checked);
  setBusy(true);setStatus('Đang tìm đường bằng '+(algorithm()==='astar'?'A*':'Dijkstra')+'…');
  try {
    const result=await requestJSON('/api/route',{signal:controller.signal,body:{start,goal,algorithm:algorithm()}});
    if(revision!==state.revision)return;
    displayResult(result);$('connection').classList.remove('is-error');$('connectionText').textContent='Backend Python · đã kết nối';
  } catch(error) {
    if(revision!==state.revision)return;
    if(timedOut)setStatus('Backend phản hồi quá chậm. Hãy thử tìm đường lại.','error');
    else if(error.name!=='AbortError') {
      setStatus(error.message==='Failed to fetch'?'Không kết nối được backend. Hãy kiểm tra web_server.py.':error.message,'error');
      if(error instanceof TypeError){$('connection').classList.add('is-error');$('connectionText').textContent='Backend mất kết nối';}
    }
  } finally {
    clearTimeout(timeout);
    if(revision===state.revision){state.controller=null;setBusy(false);}
  }
}
function reset() {
  state.gpsRevision++;state.position=null;state.nearest=null;
  state.map?.userLocation(null,{focus:false});$('useGpsStartButton').hidden=true;
  $('locateButton').disabled=!state.ready;$('locateButtonText').textContent='Lấy vị trí hiện tại';
  gpsStatus('Bấm để xin quyền định vị từ thiết bị.');
  startPicker.set(null,true);goalPicker.set(null,true);
  document.querySelector('input[name="algorithm"][value="astar"]').checked=true;
  $('showWaypoints').checked=false;setTarget('start');inputsChanged();state.map?.fit();setStatus('Đã đặt lại. Hãy chọn hai địa điểm.');
}

$('routeForm').addEventListener('submit',findRoute);
$('locateButton').addEventListener('click',locateDevice);
$('useGpsStartButton').addEventListener('click',()=>{
  if(!state.nearest?.eligible)return;
  startPicker.set(state.nearest.node.id);setTarget('goal');
  gpsStatus('Điểm đầu: '+state.nearest.node.name+'. Lộ trình tính từ node này; chưa gồm đoạn từ GPS đến node.');
});
$('resetButton').addEventListener('click',reset);
$('swapButton').addEventListener('click',()=>{
  const start=startPicker.id,goal=goalPicker.id;startPicker.set(goal,true);goalPicker.set(start,true);inputsChanged();
});
document.querySelectorAll('input[name="algorithm"]').forEach(input=>input.addEventListener('change',inputsChanged));
$('selectStartButton').addEventListener('click',()=>setTarget('start'));
$('selectGoalButton').addEventListener('click',()=>setTarget('goal'));
$('showWaypoints').addEventListener('change',renderRouteList);
$('showGraph').addEventListener('change',()=>state.map?.graph($('showGraph').checked));
$('showBuildings').addEventListener('change',()=>state.map?.buildings($('showBuildings').checked));
$('showLabels').addEventListener('change',()=>state.map?.selection(startPicker.id,goalPicker.id,$('showLabels').checked));
$('fitButton').addEventListener('click',()=>state.map?.fit());
function expandMap(expanded) {
  document.querySelector('.map-card').classList.toggle('is-expanded',expanded);
  document.body.classList.toggle('map-expanded',expanded);
  const label=expanded?'Thu nhỏ bản đồ':'Mở rộng bản đồ';
  $('expandMapButton').setAttribute('aria-pressed',String(expanded));
  $('expandMapButton').setAttribute('aria-label',label);
  $('expandMapButton').title=label;
}
$('expandMapButton').addEventListener('click',()=>expandMap($('expandMapButton').getAttribute('aria-pressed')!=='true'));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&document.body.classList.contains('map-expanded')) {
    expandMap(false);$('expandMapButton').focus();
  }
});
$('demoButton').addEventListener('click',()=>{
  if(!state.ready)return;startPicker.set('N001',true);goalPicker.set('N017',true);inputsChanged();findRoute();
});
for(const [id,type] of [['roadmapButton','roadmap'],['satelliteButton','hybrid'],['threeDButton','3d']]) {
  $(id).addEventListener('click',()=>{
    state.map?.mapType(type);
    $('roadmapButton').classList.toggle('is-active',type==='roadmap');$('satelliteButton').classList.toggle('is-active',type==='hybrid');
    $('threeDButton').classList.toggle('is-active',type==='3d');
  });
}
$('aboutButton').addEventListener('click',()=>$('aboutDialog').showModal());
$('closeAboutButton').addEventListener('click',()=>$('aboutDialog').close());
$('aboutDialog').addEventListener('click',event=>{if(event.target===$('aboutDialog'))$('aboutDialog').close();});

async function bootstrap() {
  try {
    const [data,config,buildings,basemap]=await Promise.all([requestJSON('/api/graph'),requestJSON('/api/config'),requestJSON('/api/buildings'),requestJSON('/api/basemap')]);
    data.buildings=buildings;data.basemap=basemap;
    state.data=data;state.ready=true;
    $('locateButton').disabled=false;
    const locations=data.nodes.filter(node=>node.type==='location');
    startPicker.setNodes(locations);goalPicker.setNodes(locations);
    $('locationCount').textContent=data.stats.locations;$('nodeCount').textContent=data.stats.nodes;$('edgeCount').textContent=data.stats.edges;
    $('aboutData').textContent=data.stats.locations+' địa điểm, '+data.stats.waypoints+' waypoint, '+data.stats.edges+' cạnh; '+buildings.features.length+' đường bao tòa nhà từ OpenStreetMap.';
    $('connectionText').textContent='Backend Python · đã kết nối';
    setBusy(false);setStatus('Chọn địa điểm trong danh sách hoặc click marker.');
    state.map=await createCampusMap($('map'),data,config,{select:selectOnMap,notice,provider:providerChanged});
    providerChanged(state.map.provider);
    state.map.selection(startPicker.id,goalPicker.id,$('showLabels').checked);state.map.graph($('showGraph').checked);
    state.map.buildings($('showBuildings').checked);
    if(state.position)state.map.userLocation(state.position,{focus:false});
    if(state.result)state.map.route(state.result);
  } catch(error) {
    state.ready=false;setBusy(false);$('connection').classList.add('is-error');$('connectionText').textContent='Chưa kết nối backend';
    setStatus('Không tải được dữ liệu. Hãy chạy web_server.py và truy cập địa chỉ server. '+error.message,'error');
    $('providerBadge').textContent='Chưa có dữ liệu';
  }
}
bootstrap();
