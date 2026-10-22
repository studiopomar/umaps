import {groupByCity} from './travel.js';
export async function createGlobe(host,cities,onGroup,onFailure) {
 let globe=null,paused=false,earthquakes=[],reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,cityGroups=[],people=[],layoutTimer=null,lastLayoutKey='',renderedCityLayout=[],flightMarkers=new Map();
 const routePosition=(from,to,progress)=>{
  const rad=Math.PI/180,deg=180/Math.PI,lat1=from.lat*rad,lon1=from.lng*rad,lat2=to.lat*rad,lon2=to.lng*rad;
  const angle=Math.acos(Math.max(-1,Math.min(1,Math.sin(lat1)*Math.sin(lat2)+Math.cos(lat1)*Math.cos(lat2)*Math.cos(lon2-lon1))));
  if(angle<1e-8)return {lat:from.lat,lng:from.lng};
  const scale=Math.sin(angle),a=Math.sin((1-progress)*angle)/scale,b=Math.sin(progress*angle)/scale;
  const x=a*Math.cos(lat1)*Math.cos(lon1)+b*Math.cos(lat2)*Math.cos(lon2),y=a*Math.cos(lat1)*Math.sin(lon1)+b*Math.cos(lat2)*Math.sin(lon2),z=a*Math.sin(lat1)+b*Math.sin(lat2);
  return {lat:Math.atan2(z,Math.hypot(x,y))*deg,lng:Math.atan2(y,x)*deg};
 };
 const routeBearing=(from,to)=>{
  const rad=Math.PI/180,lat1=from.lat*rad,lat2=to.lat*rad,delta=(to.lng-from.lng)*rad;
  return (Math.atan2(Math.sin(delta)*Math.cos(lat2),Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(delta))*180/Math.PI+360)%360;
 };
 const renderHtml=()=>{if(globe)globe.htmlTransitionDuration(0).htmlElementsData([...renderedCityLayout,...flightMarkers.values()]);};
 const visibleFrom=(lat,lng,view)=>{
  const rad=Math.PI/180,a=lat*rad,b=view.lat*rad,delta=(lng-view.lng)*rad;
  return Math.sin(a)*Math.sin(b)+Math.cos(a)*Math.cos(b)*Math.cos(delta)>-.08;
 };
 const layoutMarkers=()=>{
  if(!globe||!cityGroups.length)return;
  const view=globe.pointOfView(),projected=cityGroups.map(group=>({...group,screen:visibleFrom(group.lat,group.lng,view)?globe.getScreenCoords(group.lat,group.lng,.025):null}));
  const pending=projected.filter(group=>group.screen&&group.screen.x>-46&&group.screen.x<host.clientWidth+46&&group.screen.y>-46&&group.screen.y<host.clientHeight+46),onScreen=new Set(pending.map(group=>group.city)),clusters=[];
  for(const group of pending){
   const cluster=clusters.find(item=>Math.hypot(item.screen.x-group.screen.x,item.screen.y-group.screen.y)<48);
   if(cluster){cluster.people.push(...group.people);cluster.cityIds.push(group.city);}
   else clusters.push({...group,people:[...group.people],cityIds:[group.city]});
  }
  const layout=clusters.map(group=>({...group,clusterCount:group.cityIds.length,name:group.cityIds.length>1?`${group.name} + ${group.cityIds.length-1} lugares`:group.name}));
  // Off-screen and back-face cities stay in Globe.GL so rotation can reveal them.
  layout.push(...projected.filter(group=>!onScreen.has(group.city)));
  const key=layout.map(group=>group.cityIds?[...group.cityIds].sort().join('+'):group.city).join('|');
  if(key===lastLayoutKey)return;lastLayoutKey=key;
  renderedCityLayout=layout;renderHtml();
 };
 const scheduleMarkerLayout=()=>{clearTimeout(layoutTimer);layoutTimer=setTimeout(layoutMarkers,100);};
 try {
  const canvas=document.createElement('canvas');
  if(!canvas.getContext('webgl2'))throw Error('WebGL indisponível');
  const [{default:Globe},response]=await Promise.all([import('../vendor/globe.js'),fetch('./data/countries.geojson')]);
  if(!response.ok)throw Error('Geografia indisponível');
  const countries=await response.json();
  globe=new Globe(host,{animateIn:!reduced}).backgroundColor('#00000000').showAtmosphere(true).atmosphereColor('#a6a0ff').atmosphereAltitude(.17)
   .polygonsData(countries.features.filter(f=>f.properties.ISO_A2!=='AQ')).polygonAltitude(.006).polygonCapColor(()=>'#55568d').polygonSideColor(()=>'#222c58').polygonStrokeColor(()=>'#9591c555')
   .htmlLat(d=>d.lat).htmlLng(d=>d.lng).htmlAltitude(d=>d.kind==='flight-plane'?.045:.025).htmlElement(group=>{
    if(group.kind==='flight-plane'){
     const plane=document.createElement('span');plane.className='flight-plane';plane.title=`${group.name} viajando para ${group.destination}`;plane.setAttribute('aria-label',plane.title);
     const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.style.transform=`rotate(${group.bearing}deg)`;
     const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z');svg.append(path);plane.append(svg);return plane;
    }
    const button=document.createElement('button');button.className='marker'+(group.clusterCount>1?' marker-cluster':'');button.title=group.clusterCount>1?`${group.people.length} personagens em ${group.clusterCount} lugares próximos`:`${group.name}: ${group.people.length} personagens`;button.setAttribute('aria-label',button.title);
    const img=document.createElement('img');img.src=group.people[0].image||'./assets/avatar.svg';img.alt='';img.onerror=()=>{img.onerror=null;img.src='./assets/avatar.svg';};button.append(img);
    if(group.people.length>1){const badge=document.createElement('span');badge.textContent=group.clusterCount>1?group.clusterCount:group.people.length;button.append(badge);}
    button.onclick=()=>onGroup(group);return button;
   }).onZoom(scheduleMarkerLayout).arcsData([]).arcColor(()=>['#f5d68b','#e7b77d']).arcStroke(.6).arcAltitudeAutoScale(.35).arcDashLength(.45).arcDashGap(.2).arcDashAnimateTime(reduced?0:2400).ringsData([]).ringLat(d=>d.lat).ringLng(d=>d.lng).ringAltitude(.008).ringMaxRadius(2.2).ringPropagationSpeed(.8).ringRepeatPeriod(2600).ringColor(()=>t=>`rgba(244, 210, 157, ${Math.max(0,1-t)})`);
  globe.globeMaterial().color.set('#17244c');globe.globeMaterial().shininess=12;
  globe.controls().autoRotate=!reduced;globe.controls().autoRotateSpeed=.28;globe.controls().enablePan=false;globe.controls().minDistance=160;globe.controls().maxDistance=650;
  globe.controls().addEventListener('end',scheduleMarkerLayout);
  globe.controls().addEventListener('change',scheduleMarkerLayout);
  globe.pointOfView({lat:-15,lng:-48,altitude:2.15},0);
  const resize=()=>{globe.width(host.clientWidth).height(host.clientHeight);};new ResizeObserver(resize).observe(host);resize();
  globe.renderer().domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();globe.pauseAnimation();onFailure();});
 } catch(e) {host.replaceChildren();onFailure();}
 const setMotion=()=>{if(!globe)return;globe.controls().autoRotate=!paused&&!reduced;globe.arcDashAnimateTime(paused||reduced?0:2400);globe.ringsData(paused||reduced?[]:earthquakes);globe.resumeAnimation();};
 matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{reduced=e.matches;setMotion();});
 return {
  update(characters,state){if(!globe)return;people=characters;cityGroups=groupByCity(characters,state).map(g=>({...g,...cities.find(c=>c.id===g.city)}));lastLayoutKey='';layoutMarkers();this.routes(state);},
  focus(city){if(!globe)return;globe.pointOfView({lat:city.lat,lng:city.lng,altitude:1.7},paused||reduced?0:850);},
  pause(value){paused=value;setMotion();},
  earthquakes(value){earthquakes=value;setMotion();},
  flights(state,now=Date.now()){
   if(!globe)return;const active=(state.ambientFlights||[]).filter(flight=>flight.status==='travelling'),ids=new Set(active.map(flight=>flight.id));
   for(const id of flightMarkers.keys())if(!ids.has(id))flightMarkers.delete(id);
   for(const flight of active){
    const from=cities.find(city=>city.id===flight.from),to=cities.find(city=>city.id===flight.to),person=people.find(item=>item.id===flight.characterId);if(!from||!to||!person)continue;
    const progress=Math.max(0,Math.min(1,(now-flight.departedAt)/(flight.arrivesAt-flight.departedAt))),position=routePosition(from,to,progress),plane=flightMarkers.get(flight.id)||{id:`plane-${flight.id}`,kind:'flight-plane'};
    Object.assign(plane,position,{bearing:routeBearing(from,to),name:person.name,destination:to.name});flightMarkers.set(flight.id,plane);
   }
   renderHtml();
  },
  routes(state){if(!globe)return;const m=state.meeting,meetingRoutes=m?.status==='travelling'?m.participants.map(id=>{const from=cities.find(c=>c.id===m.from[id]),to=cities.find(c=>c.id===m.city);return from&&to?{startLat:from.lat,startLng:from.lng,endLat:to.lat,endLng:to.lng}:null;}):[],flightRoutes=(state.ambientFlights||[]).filter(flight=>flight.status==='travelling').map(flight=>{const from=cities.find(c=>c.id===flight.from),to=cities.find(c=>c.id===flight.to);return from&&to?{startLat:from.lat,startLng:from.lng,endLat:to.lat,endLng:to.lng}:null;});globe.arcsData([...meetingRoutes,...flightRoutes].filter(Boolean));this.flights(state);}
 };
}
