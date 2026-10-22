export const KEY='umaps:v2';
export const freshState = () => ({version:2,destinations:{},ambientDestinations:{},ambientFlights:[],meeting:null,history:[],lastScenes:{},preferences:{paused:false,collapsed:false}});
export function sanitize(raw, characters, cities, scenes) {
  const state=freshState(), people=new Set(characters.map(p=>p.id)), places=new Set(cities.map(c=>c.id));
  if (!raw || raw.version!==2) return state;
  for (const [id,city] of Object.entries(raw.destinations||{})) if (people.has(id)&&places.has(city)) state.destinations[id]=city;
  for (const [id,city] of Object.entries(raw.ambientDestinations||{})) if (people.has(id)&&places.has(city)) state.ambientDestinations[id]=city;
  state.ambientFlights=(Array.isArray(raw.ambientFlights)?raw.ambientFlights:[]).filter(flight=>flight&&people.has(flight.characterId)&&places.has(flight.from)&&places.has(flight.to)&&flight.from!==flight.to&&['local','nacional','internacional'].includes(flight.category)&&['travelling','arrived'].includes(flight.status)&&Number.isFinite(flight.departedAt)&&Number.isFinite(flight.arrivesAt)&&flight.arrivesAt>flight.departedAt&&Number.isFinite(flight.flightMinutes)&&Number.isFinite(flight.distanceKm)).slice(-12).map(flight=>({...flight}));
  for (const key of ['paused','collapsed']) state.preferences[key]=raw.preferences?.[key]===true;
  state.history=(Array.isArray(raw.history)?raw.history:[]).filter(m=>m&&typeof m.speaker==='string'&&typeof m.text==='string').slice(-100).map(m=>({speaker:m.speaker.slice(0,100),text:m.text.slice(0,1500)}));
  for(const [topic,id] of Object.entries(raw.lastScenes||{})) if(scenes.some(s=>s.id===id&&s.topic===topic)) state.lastScenes[topic]=id;
  const m=raw.meeting;
  if (m&&Array.isArray(m.participants)&&m.participants.length>=2&&m.participants.length<=4&&new Set(m.participants).size===m.participants.length&&m.participants.every(id=>people.has(id))&&places.has(m.city)&&scenes.some(s=>s.id===m.scene&&s.topic===m.topic)&&[0,1,2].includes(m.step)&&['travelling','arrived'].includes(m.status)) {
    state.meeting={participants:m.participants,city:m.city,topic:m.topic,scene:m.scene,step:m.step,status:m.status,choices:Array.isArray(m.choices)?m.choices.filter(v=>v===0||v===1).slice(0,m.step):[],from:{}};
    for(const id of m.participants) state.meeting.from[id]=places.has(m.from?.[id])?m.from[id]:characters.find(p=>p.id===id).defaultCity;
    if(m.status==='arrived') for(const id of m.participants) state.destinations[id]=m.city;
  }
  return state;
}
export function createStorage(onError=()=>{}) {
  return {
    load(){try{return JSON.parse(localStorage.getItem(KEY));}catch{onError();return null;}},
    save(state){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{onError();return false;}},
    clear(){try{localStorage.removeItem(KEY);return true;}catch{onError();return false;}}
  };
}
