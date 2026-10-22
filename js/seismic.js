export const FEED_URL='https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';
const radians=degrees=>degrees*Math.PI/180;
export function distanceKm(a,b){const dLat=radians(b.lat-a.lat),dLng=radians(b.lng-a.lng),x=Math.sin(dLat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dLng/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
export function nearbyLightQuakes(payload,cities,now=Date.now()){
 if(payload?.type!=='FeatureCollection'||!Array.isArray(payload.features))throw Error('Feed sísmico inválido');
 const places=[];
 for(const feature of payload.features){
  const p=feature?.properties,coords=feature?.geometry?.coordinates;
  if(!p||typeof feature.id!=='string'||!Array.isArray(coords)||coords.length<2)continue;
  const [lng,lat]=coords,mag=p.mag,time=p.time;
  if(!Number.isFinite(lat)||lat < -90||lat>90||!Number.isFinite(lng)||lng < -180||lng>180||!Number.isFinite(mag)||mag<.5||mag>=4||!Number.isFinite(time)||time>now||now-time>60*60*1000||typeof p.url!=='string'||!p.url.startsWith('https://earthquake.usgs.gov/'))continue;
  const closeCities=cities.map(city=>({...city,distance:distanceKm({lat,lng},{lat:city.lat,lng:city.lng})})).filter(city=>city.distance<=220);
  if(closeCities.length)places.push({id:feature.id,lat,lng,mag,time,place:typeof p.place==='string'?p.place:'Local não informado',url:p.url,cities:closeCities});
 }
 return places.sort((a,b)=>b.time-a.time);
}
export async function loadNearbyQuakes(cities,fetcher=fetch){
 const response=await fetcher(FEED_URL,{cache:'no-cache',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error(`USGS retornou ${response.status}`);
 return nearbyLightQuakes(await response.json(),cities);
}
