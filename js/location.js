/** One-shot browser positioning and explicit mapping to a named campus location. */
export function distanceMeters(a, b) {
  const radians = value => value * Math.PI / 180;
  const dlat=radians(b.lat-a.lat), dlon=radians(b.lng-a.lng);
  const h=Math.sin(dlat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dlon/2)**2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}

export function normalizePosition(position) {
  const {latitude,longitude,accuracy}=position.coords || {};
  if (![latitude,longitude,accuracy].every(Number.isFinite) || Math.abs(latitude)>90 || Math.abs(longitude)>180 || accuracy<0)
    throw new Error('Thiết bị trả về tọa độ hoặc độ chính xác không hợp lệ.');
  return {lat:latitude,lng:longitude,accuracy};
}

export function nearestLocation(position, nodes, {maxDistance=100,maxAccuracy=100}={}) {
  const candidates=nodes.filter(node=>node.type==='location').map(node=>({node,distance:distanceMeters(position,{lat:node.lat,lng:node.lon})}));
  candidates.sort((a,b)=>a.distance-b.distance);
  const closest=candidates[0] || null;
  if(!closest)return {eligible:false,reason:'no_locations',node:null,distance:null};
  if(closest.distance>maxDistance)return {...closest,eligible:false,reason:'outside_campus'};
  if(position.accuracy>maxAccuracy)return {...closest,eligible:false,reason:'low_accuracy'};
  return {...closest,eligible:true,reason:'nearby'};
}

export function positionError(error) {
  return {1:'Bạn chưa cho phép truy cập vị trí. Hãy bật quyền Vị trí cho website rồi thử lại.',
          2:'Thiết bị chưa xác định được vị trí. Hãy bật định vị/GPS và kiểm tra kết nối.',
          3:'Lấy vị trí quá thời gian chờ. Hãy thử lại ở nơi có tín hiệu tốt hơn.'}[error?.code] || 'Không lấy được vị trí từ thiết bị.';
}

export function getDevicePosition(geolocation, secureContext=true) {
  if(!secureContext)return Promise.reject(new Error('Định vị cần HTTPS. Trên máy này có thể dùng localhost hoặc 127.0.0.1.'));
  if(!geolocation)return Promise.reject(new Error('Trình duyệt này không hỗ trợ định vị.'));
  return new Promise((resolve,reject)=>{
    geolocation.getCurrentPosition(position=>{
      try { resolve(normalizePosition(position)); } catch(error) { reject(error); }
    },error=>reject(new Error(positionError(error))),{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  });
}
