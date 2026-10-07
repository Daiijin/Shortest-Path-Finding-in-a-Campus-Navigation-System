import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const moduleText=readFileSync(new URL('./js/location.js',import.meta.url));
const {distanceMeters,normalizePosition,nearestLocation,getDevicePosition}=await import('data:text/javascript;base64,'+moduleText.toString('base64'));
const origin={lat:20,lng:105,accuracy:8};
const nodes=[{id:'A',type:'location',lat:20.0005,lon:105,name:'A'},
             {id:'B',type:'location',lat:20.002,lon:105,name:'B'},
             {id:'W',type:'waypoint',lat:20,lon:105,name:'Routing Node'}];

test('metre distances are symmetric and zero at the same coordinate',()=>{
  assert.equal(distanceMeters(origin,origin),0);
  assert.ok(Math.abs(distanceMeters(origin,{lat:20.001,lng:105})-111.1949)<.01);
  assert.equal(distanceMeters(origin,{lat:20.001,lng:105}),distanceMeters({lat:20.001,lng:105},origin));
});
test('nearest suggestion selects locations and excludes waypoints',()=>{
  const match=nearestLocation(origin,nodes);assert.equal(match.node.id,'A');assert.equal(match.eligible,true);
  assert.ok(match.distance>55&&match.distance<56);
});
test('outside campus does not offer a misleading start node',()=>{
  const match=nearestLocation({lat:21,lng:105,accuracy:5},nodes);
  assert.equal(match.eligible,false);assert.equal(match.reason,'outside_campus');
});
test('wide accuracy radius prevents start suggestion',()=>{
  const match=nearestLocation({...origin,accuracy:250},nodes);
  assert.equal(match.eligible,false);assert.equal(match.reason,'low_accuracy');
});
test('empty location set and invalid device coordinates are handled',()=>{
  assert.equal(nearestLocation(origin,[]).reason,'no_locations');
  for(const coords of [{latitude:NaN,longitude:105,accuracy:8},{latitude:91,longitude:105,accuracy:8},{latitude:20,longitude:105,accuracy:-1}])
    assert.throws(()=>normalizePosition({coords}));
});
test('one-shot GPS requests fresh high-accuracy data and reports radius',async()=>{
  let options;
  const geo={getCurrentPosition(success,error,received){options=received;success({coords:{latitude:20,longitude:105,accuracy:8}});}};
  assert.deepEqual(await getDevicePosition(geo,true),origin);
  assert.equal(options.enableHighAccuracy,true);assert.equal(options.maximumAge,0);assert.equal(options.timeout,15000);
});
test('permission denial, unavailable signal and timeout have useful messages',async()=>{
  for(const code of [1,2,3]) {
    const geo={getCurrentPosition(success,error){error({code});}};
    await assert.rejects(getDevicePosition(geo,true),error=>error.message.length>30);
  }
});
test('secure context and browser capability are checked before requesting GPS',async()=>{
  let requested=false;const geo={getCurrentPosition(){requested=true;}};
  await assert.rejects(getDevicePosition(geo,false),/HTTPS/);assert.equal(requested,false);
  await assert.rejects(getDevicePosition(null,true),/không hỗ trợ/);
});
