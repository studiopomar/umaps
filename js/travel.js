export const destination = (person,state) => state.destinations[person.id] || state.ambientDestinations?.[person.id] || person.defaultCity;
export function groupByCity(characters,state) {
  const groups=new Map();
  for(const person of characters) {const city=destination(person,state);if(!groups.has(city))groups.set(city,[]);groups.get(city).push(person);}
  return [...groups].map(([city,people])=>({city,people}));
}
export function startMeeting(state, participants, city, topic, scene, characters, cities) {
  if(participants.length<2||participants.length>4||new Set(participants).size!==participants.length||!participants.every(id=>characters.some(p=>p.id===id))||!cities.some(c=>c.id===city)||scene.topic!==topic) throw Error('Escolha de dois a quatro participantes e uma cidade do catálogo.');
  state.meeting={participants:[...participants],city,topic,scene:scene.id,step:0,choices:[],status:'travelling',from:Object.fromEntries(participants.map(id=>[id,destination(characters.find(p=>p.id===id),state)]))};
  state.lastScenes[topic]=scene.id;
}
export function arrive(state) {const m=state.meeting;if(!m||m.status!=='travelling')return false;for(const id of m.participants)state.destinations[id]=m.city;m.status='arrived';return true;}
