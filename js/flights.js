const EARTH_KM=6371;

export function distanceKm(from,to){
 const radians=value=>value*Math.PI/180,lat1=radians(from.lat),lat2=radians(to.lat),dLat=lat2-lat1,dLng=radians(to.lng-from.lng);
 const a=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
 return 2*EARTH_KM*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
export function flightCategory(from,to,distance=distanceKm(from,to)){
 if(from.country!==to.country)return 'internacional';
 return distance<450?'local':'nacional';
}
function optionsFor(person,state,cities,category){
 const from=cities.find(city=>city.id===destinationId(person,state));
 if(!from)return [];
 return cities.filter(to=>to.id!==from.id&&flightCategory(from,to)===category).map(to=>({person,from,to,distance:distanceKm(from,to)}));
}
function destinationId(person,state){return state.destinations?.[person.id]||state.ambientDestinations?.[person.id]||person.defaultCity;}

export function createAmbientFlight(state,characters,cities,category,now=Date.now(),random=Math.random){
 const activeIds=new Set((state.ambientFlights||[]).filter(flight=>flight.status==='travelling').map(flight=>flight.characterId));
 const meetingIds=new Set(state.meeting?.participants||[]);
 const recentIds=new Set((state.ambientFlights||[]).slice(-5).map(flight=>flight.characterId));
 let candidates=characters.filter(person=>!activeIds.has(person.id)&&!meetingIds.has(person.id)&&!Object.hasOwn(state.destinations||{},person.id)).flatMap(person=>optionsFor(person,state,cities,category));
 if(!candidates.length)return false;
 const fresh=candidates.filter(candidate=>!recentIds.has(candidate.person.id));if(fresh.length)candidates=fresh;
 const candidate=candidates[Math.floor(random()*candidates.length)];
 const flightMinutes=Math.max(35,Math.ceil(candidate.distance/780*60+30+(category==='internacional'?20:0)));
 const flight={id:`flight-${now}-${candidate.person.id}`,characterId:candidate.person.id,from:candidate.from.id,to:candidate.to.id,category,distanceKm:Math.round(candidate.distance),departedAt:now,arrivesAt:now+flightMinutes*60_000,flightMinutes,status:'travelling'};
 state.ambientFlights=[...(state.ambientFlights||[]),flight].slice(-12);return flight;
}

export function advanceAmbientFlights(state,now=Date.now()){
 let changed=false;state.ambientDestinations||={};state.ambientFlights||=[];
 for(const flight of state.ambientFlights){
  if(flight.status==='travelling'&&flight.arrivesAt<=now){
   flight.status='arrived';flight.arrivedAt=flight.arrivesAt;
   if(!Object.hasOwn(state.destinations||{},flight.characterId))state.ambientDestinations[flight.characterId]=flight.to;
   changed=true;
  }
 }
 const recent=state.ambientFlights.filter(flight=>flight.status==='travelling'||now-(flight.arrivedAt||flight.arrivesAt)<24*60*60*1000);
 if(recent.length!==state.ambientFlights.length){state.ambientFlights=recent;changed=true;}
 return changed;
}

export function cancelAmbientFlight(state,characterId){
 const count=(state.ambientFlights||[]).length;
 state.ambientFlights=(state.ambientFlights||[]).filter(flight=>flight.characterId!==characterId||flight.status!=='travelling');
 return state.ambientFlights.length!==count;
}

export function flightProgress(flight,now=Date.now()){
 const duration=flight.arrivesAt-flight.departedAt;
 return Math.max(0,Math.min(1,(now-flight.departedAt)/duration));
}
export function formatFlightDuration(milliseconds){
 const minutes=Math.max(0,Math.ceil(milliseconds/60_000)),hours=Math.floor(minutes/60),rest=minutes%60;
 return hours?`${hours} h ${String(rest).padStart(2,'0')} min`:`${rest} min`;
}
export function formatElapsed(milliseconds){
 const minutes=Math.max(0,Math.floor(milliseconds/60_000)),hours=Math.floor(minutes/60),rest=minutes%60;
 return hours?`${hours}h ${String(rest).padStart(2,'0')}m`:`${rest} min`;
}
