import {loadCatalog,normalize,refreshCatalog} from './catalog.js';
import {createStorage,freshState,sanitize} from './storage.js';
import {destination,startMeeting,arrive} from './travel.js';
import {topics,scenes,pickScene,openScene,choose} from './dialogue.js';
import {randomExchange} from './ambient-chat.js';
import {createGlobe} from './globe.js';
import {loadNearbyQuakes} from './seismic.js';
import {getForecast,getCapitalsWeather,describeWeather,clearForecastCache,ATTRIBUTION_URL} from './weather.js';
import {getWikiPreview} from './wiki.js';
import {createAmbientFlight,advanceAmbientFlights,cancelAmbientFlight,flightProgress,formatElapsed,formatFlightDuration} from './flights.js';
const $=id=>document.getElementById(id);
const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
let noticeTimer;
function notify(text){$('notice').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',6500);}
let storageFailed=false;
const storage=createStorage(()=>{storageFailed=true;$('data-status').textContent='Armazenamento indisponível. As escolhas funcionam apenas nesta sessão.';});
let characters=[],cities=[],capitals=[],state=freshState(),selected=new Set(),active=null,globe=null,tripTimer=null,tripRemaining=5000,tripStarted=0,quakeTimer=null,chatOpen=false,ambientTimer=null,ambientChatTimer=null,ambientChat=[],ambientTopic='',capitalWeatherTimer=null,ambientEnabled=true;
const cityById=id=>cities.find(c=>c.id===id);
const save=()=>{storage.save(state);if(storageFailed)notify('Armazenamento indisponível: este encontro fica apenas nesta sessão.');};
function portrait(person){const img=node('img');img.src=person.image||'./assets/avatar.svg';img.alt='';img.loading='lazy';img.onerror=()=>{img.onerror=null;img.src='./assets/avatar.svg';};return img;}
function option(value,text){const e=node('option',text);e.value=value;return e;}
function tab(name){for(const value of ['explore','meeting']){$(value).hidden=value!==name;$(value+'-tab').setAttribute('aria-selected',String(value===name));}expand();}
function expand(){if(state.preferences.collapsed){state.preferences.collapsed=false;applyCollapse();save();}}
function applyCollapse(){$('panel').classList.toggle('collapsed',state.preferences.collapsed);$('collapse').setAttribute('aria-expanded',String(!state.preferences.collapsed));$('collapse').firstChild.textContent=state.preferences.collapsed?'Abrir personagens e encontros ':'Recolher painel ';}
function toggle(id){if(selected.has(id))selected.delete(id);else if(selected.size<4)selected.add(id);else return notify('O encontro tem espaço para até quatro personagens.');renderParticipants();renderList();}
const countryNames=()=>[...new Set(cities.map(city=>city.country))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
function fillCountryOptions(select){for(const country of countryNames()){const count=cities.filter(city=>city.country===country).length;select.append(option(country,`${country} · ${count} lugares`));}}
function fillMeetingCities(preferredId){
 const available=cities.filter(city=>city.country===$('meeting-country').value).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const select=$('city');select.replaceChildren();for(const city of available)select.append(option(city.id,city.name));
 select.value=available.some(city=>city.id===preferredId)?preferredId:(available[0]?.id||'');
 select.disabled=available.length===0||state.meeting?.status==='travelling';
 return select.value;
}
function renderList(){
 const query=normalize($('search').value),country=$('person-country').value;
 const visible=characters.filter(p=>normalize(p.name).includes(query)&&(!country||cityById(destination(p,state)).country===country));
 $('count').textContent=`${visible.length} ${visible.length===1?'personagem':'personagens'}`;
 const fragment=document.createDocumentFragment();
 for(const p of visible){const c=cityById(destination(p,state)),row=node('div',undefined,'person'),open=node('button',undefined,'person-open');open.type='button';open.setAttribute('aria-label',`Ver ficha de ${p.name}`);open.append(portrait(p));const info=node('span');info.append(node('strong',p.name),node('small',`${c.name}`));open.append(info);open.onclick=()=>showProfile(p);const add=node('button',selected.has(p.id)?'✓':'+','add');add.type='button';add.setAttribute('aria-label',`${selected.has(p.id)?'Retirar':'Adicionar'} ${p.name} ${selected.has(p.id)?'do':'ao'} encontro`);add.setAttribute('aria-pressed',String(selected.has(p.id)));add.onclick=()=>toggle(p.id);row.append(open,add);fragment.append(row);}
 if(!visible.length)fragment.append(node('p','Nenhum personagem encontrado. Tente outro nome.','muted'));
 $('characters').replaceChildren(fragment);
}
let weatherRequest=0;
function addWeatherCredit(container){
 const credit=node('a','Dados meteorológicos: Open-Meteo · CC BY 4.0 ↗','weather-credit');credit.href=ATTRIBUTION_URL;credit.target='_blank';credit.rel='noopener noreferrer';container.append(credit);
}
async function updateWeather(cityId=$('city').value,refresh=false){
 const city=cityById(cityId),container=$('weather-card');if(!city||!container)return;
 const request=++weatherRequest;
 if(refresh)clearForecastCache();
 container.replaceChildren();
 const heading=node('strong',`Previsão em ${city.name}`,'weather-title'),loading=node('p','Consultando a previsão para os próximos três dias…','weather-loading');container.append(heading,loading);
 try{
  const forecast=await getForecast(city);
  if(request!==weatherRequest||$('city').value!==cityId)return;
  const list=node('div',undefined,'weather-days');
  const dateFormat=new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',timeZone:'UTC'});
  for(const day of forecast.days){
   const item=node('article',undefined,'weather-day'),[icon,description]=describeWeather(day.code),date=new Date(`${day.date}T12:00:00Z`);
   item.append(node('span',dateFormat.format(date),'weather-date'),node('span',icon,'weather-icon'),node('span',description,'weather-condition'),node('strong',`${Math.round(day.min)}° / ${Math.round(day.max)}°`,'weather-temperatures'));
   item.append(node('small',Number.isFinite(day.rain)?`Chuva até ${Math.round(day.rain)}%`:'Chance de chuva indisponível','weather-rain'));list.append(item);
  }
  container.replaceChildren(heading,list);addWeatherCredit(container);
  const update=node('button','Atualizar previsão','weather-update');update.type='button';update.onclick=()=>updateWeather(cityId,true);container.append(update);
 }catch{
  if(request!==weatherRequest||$('city').value!==cityId)return;
  container.replaceChildren(heading,node('p','Não foi possível carregar a previsão agora.','weather-error'));
  addWeatherCredit(container);
  const update=node('button','Tentar novamente','weather-update');update.type='button';update.onclick=()=>updateWeather(cityId,true);container.append(update);
 }
}
async function updateCapitalWeather(){
 const container=$('capital-weather');if(!capitals.length)return;
 if(!container.querySelector('.capital-weather-card'))container.replaceChildren(node('p','Consultando o clima nas capitais…','live-loading'));
 try{
  const weather=await getCapitalsWeather(capitals,cities),fragment=document.createDocumentFragment();
  for(const item of weather){
   const [icon,description]=describeWeather(item.code),card=node('article',undefined,'capital-weather-card');
   card.title=`${item.name}, capital de ${item.country}: ${description}`;card.setAttribute('aria-label',card.title);
   const localTime=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:item.timezone}).format(new Date());
   card.append(node('span',item.name,'capital-city'),node('strong',`${icon} ${Math.round(item.current)}°`),node('small',item.country,'capital-country'),node('small',`Hoje ${Math.round(item.min)}°–${Math.round(item.max)}° · ${localTime}`));
   if(Number.isFinite(item.rain))card.append(node('small',`Chuva até ${Math.round(item.rain)}%`));fragment.append(card);
  }
  container.replaceChildren(fragment);$('weather-refresh-time').textContent=`Atualizado às ${new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date())}`;
 }catch{
  container.replaceChildren(node('p','Previsão temporariamente indisponível.','live-loading live-weather-error'));
  const retry=node('button','Tentar novamente','live-weather-retry');retry.type='button';retry.onclick=()=>updateCapitalWeather();container.append(retry);
 }
}
const flightLabels={local:'Local',nacional:'Nacional',internacional:'Internacional'};
function renderFlightFeed(now=Date.now()){
 const container=$('flight-feed');if(!container)return;const scrollLeft=container.scrollLeft;
 if(!ambientEnabled){container.replaceChildren(node('p','Viagens automáticas pausadas após limpar os dados locais.','live-loading'));return;}
 const flights=[...(state.ambientFlights||[])].sort((a,b)=>a.status===b.status?b.departedAt-a.departedAt:(a.status==='travelling'?-1:1)).slice(0,6);
 if(!flights.length){container.replaceChildren(node('p','As primeiras rotas vão aparecer em instantes…','live-loading'));return;}
 const fragment=document.createDocumentFragment();
 for(const flight of flights){
  const person=characters.find(entry=>entry.id===flight.characterId),from=cityById(flight.from),to=cityById(flight.to);if(!person||!from||!to)continue;
  const activeFlight=flight.status==='travelling',elapsed=Math.max(0,now-flight.departedAt),card=node('article',undefined,'flight-card');
  const top=node('div',undefined,'flight-card-top');top.append(node('strong',person.name),node('span',flightLabels[flight.category]));
  const route=node('div',undefined,'flight-card-route');route.append(node('span',`${from.name}, ${from.country}`),node('b','→'),node('span',`${to.name}, ${to.country}`));
  const time=node('div',undefined,'flight-card-time');
  if(activeFlight){
   const progress=flightProgress(flight,now),remaining=Math.max(0,flight.arrivesAt-now),bar=node('progress');bar.max=100;bar.value=Math.round(progress*100);bar.setAttribute('aria-label',`Progresso da viagem de ${person.name}`);
   time.append(node('span',`Chega em ${formatFlightDuration(remaining)}`),node('span',`${Math.round(progress*100)}%`));
   card.append(top,route,bar,time,node('small',`Estimativa ${formatFlightDuration(flight.arrivesAt-flight.departedAt)} · ${flight.distanceKm.toLocaleString('pt-BR')} km`,'flight-card-note'));
  }else{
   const arrivedAgo=Math.max(0,now-(flight.arrivedAt||flight.arrivesAt));
   time.append(node('span',arrivedAgo<60_000?'Chegou agora':`Chegou há ${formatElapsed(arrivedAgo)}`),node('span',`Voo ${formatFlightDuration(flight.flightMinutes*60_000)}`));
   card.append(top,route,time);
  }
  fragment.append(card);
 }
 container.replaceChildren(fragment);container.scrollLeft=scrollLeft;
}
function manageAmbientFlights(){
 if(!characters.length||!cities.length)return;
 if(!ambientEnabled){renderFlightFeed();return;}
 const now=Date.now(),hadArrival=(state.ambientFlights||[]).some(flight=>flight.status==='travelling'&&flight.arrivesAt<=now),changed=advanceAmbientFlights(state,now);
 let activeFlights=(state.ambientFlights||[]).filter(flight=>flight.status==='travelling');
 const categories=['local','nacional','internacional'],failed=new Set();let started=false;
 while(activeFlights.length<3&&failed.size<categories.length){
  const activeCategories=new Set(activeFlights.map(flight=>flight.category));
  const category=categories.find(value=>!activeCategories.has(value)&&!failed.has(value))||categories.find(value=>!failed.has(value));
  if(!category)break;
  const flight=createAmbientFlight(state,characters,cities,category,now);
  if(flight){activeFlights.push(flight);started=true;}else failed.add(category);
 }
 if(changed||started)save();
 if(hadArrival)refreshWorld();else if(started)globe?.update(characters,state);
 globe?.flights(state,now);renderFlightFeed(now);
}
function renderParticipants(){
 $('selected-count').textContent=selected.size;$('participants').replaceChildren();
 for(const id of selected){const p=characters.find(p=>p.id===id),row=node('div',undefined,'participant'),remove=node('button','Retirar');remove.type='button';remove.setAttribute('aria-label',`Retirar ${p.name} do encontro`);remove.onclick=()=>toggle(id);row.append(node('span',p.name),remove);$('participants').append(row);}
 const travelling=state.meeting?.status==='travelling',submit=$('meeting-submit');
 submit.disabled=selected.size<2||travelling;
 $('meeting-submit-hint').hidden=travelling||selected.size>=2;
 $('meeting-submit-hint').textContent=travelling?'Há uma viagem em andamento. Chegue ao encontro atual antes de organizar outro.':'Escolha pelo menos dois personagens para confirmar o encontro.';
}
function showProfile(p,focus=true){
 active=p;if(focus)tab('explore');const c=cityById(destination(p,state)),card=node('article',undefined,'profile'),close=node('button','×','close');close.setAttribute('aria-label','Fechar ficha');close.onclick=()=>{$('profile').replaceChildren();active=null;};card.append(close,portrait(p),node('h3',p.name));
 const details=node('dl');for(const [title,value] of [['Plataformas na wiki',p.platform],['Origem documentada',p.origin],['Destino',`${c.name}, ${c.country} · ${c.continent}`],['Horário local',new Intl.DateTimeFormat('pt-BR',{timeZone:c.timezone,hour:'2-digit',minute:'2-digit'}).format(new Date())+' · '+c.timezone]]){if(value){details.append(node('dt',title),node('dd',value));}}card.append(details);
 if(!p.origin)card.append(node('p','Origem geográfica não verificada.','muted'));
 const source=node('a','Ver registro e créditos na VSynthBR ↗');source.href=p.source;source.target='_blank';source.rel='noopener noreferrer';card.append(source);
 const label=node('label','Escolher outro destino');label.htmlFor='profile-city';const select=node('select');select.id='profile-city';for(const city of cities)select.append(option(city.id,`${city.name}, ${city.country}`));select.value=c.id;
 const change=node('button','Salvar destino');change.disabled=state.meeting?.status==='travelling'&&state.meeting.participants.includes(p.id);change.onclick=()=>{cancelAmbientFlight(state,p.id);state.destinations[p.id]=select.value;if(state.meeting?.participants.includes(p.id)){state.meeting=null;renderMeeting();notify('Destino salvo. O encontro anterior foi encerrado para manter as localizações coerentes.');}else notify('Destino salvo neste navegador.');save();refreshWorld();showProfile(p);};card.append(label,select,change);$('profile').replaceChildren(card);if(focus)globe?.focus(c);
}
function showGlobeCard(group,person=null){
 const card=$('globe-card');card.hidden=false;card.replaceChildren();
 const header=node('div',undefined,'globe-card-header'),title=node('h2',person?person.name:`${group.name} · ${group.people.length} UTAUs`),close=node('button','×','globe-card-close');
 close.type='button';close.setAttribute('aria-label','Fechar cartão do globo');close.onclick=()=>{card.hidden=true;card.replaceChildren();};header.append(title,close);card.append(header);
 if(!person){
  card.append(node('p',group.clusterCount>1?'Cidades próximas estão agrupadas para não sobrepor os marcadores.':'Escolha um personagem neste local.','globe-card-note'));
  const list=node('div',undefined,'globe-card-list');
  for(const member of group.people){
   const button=node('button',undefined,'globe-card-person'),city=cityById(destination(member,state)),meta=node('span',undefined,'globe-card-person-meta');button.type='button';button.setAttribute('aria-label',`Abrir cartão de ${member.name}, ${city.name}, ${city.country}`);meta.append(node('strong',member.name),node('small',`${city.name}, ${city.country}`));button.append(portrait(member),meta);button.onclick=()=>showGlobeCard(group,member);list.append(button);
  }
  card.append(list);return;
 }
 const city=cityById(destination(person,state)),summary=node('div',undefined,'globe-card-summary');summary.append(portrait(person),node('span',`${person.platform} · ${city.name}, ${city.country}`));card.append(summary);
 card.append(node('p',person.origin?`Origem: ${person.origin}`:'Origem geográfica não verificada.','globe-card-note'));
 const wiki=node('section',undefined,'globe-card-wiki');wiki.setAttribute('aria-live','polite');wiki.append(node('p','Carregando as informações iniciais da wiki…','muted'));card.append(wiki);
 getWikiPreview(person).then(({intro,facts})=>{
  if(!card.contains(wiki))return;
  wiki.replaceChildren();
  if(intro)wiki.append(node('p',intro,'globe-card-intro'));
  if(facts.length){const details=node('dl',undefined,'globe-card-facts');for(const fact of facts)details.append(node('dt',fact.label),node('dd',fact.value));wiki.append(details);}
  if(!intro&&!facts.length)wiki.append(node('p','A página não tem um resumo inicial disponível.','muted'));
 }).catch(()=>{if(card.contains(wiki))wiki.replaceChildren(node('p','Não foi possível carregar os dados da wiki agora. A ficha original continua disponível abaixo.','muted'));});
 const actions=node('div',undefined,'globe-card-actions'),add=node('button',selected.has(person.id)?'✓ No encontro':'＋ Adicionar ao encontro','globe-card-add'),full=node('button','Ficha completa');
 add.type='button';add.setAttribute('aria-pressed',String(selected.has(person.id)));add.onclick=()=>{toggle(person.id);showGlobeCard(group,person);};
 full.type='button';full.onclick=()=>{card.hidden=true;showProfile(person);};
 const source=node('a','Abrir ficha completa na Wiki VSynthBR ↗');source.href=person.source;source.target='_blank';source.rel='noopener noreferrer';
 actions.append(add,full);card.append(actions,source);
}
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(!$('globe-card').hidden){$('globe-card').hidden=true;$('globe-card').replaceChildren();}if(chatOpen){chatOpen=false;renderMeeting();}});
function refreshWorld(){renderList();globe?.update(characters,state);if(active)showProfile(active,false);updateQuakes();}
function renderQuakes(events,error=false){
 const panel=$('quake-alert');panel.replaceChildren();panel.hidden=false;
 if(error){panel.append(node('span','Monitoramento sísmico da USGS temporariamente indisponível.'));return;}
 const relevant=[];
 for(const event of events){
  const affected=event.cities.map(city=>({city,count:characters.filter(person=>destination(person,state)===city.id).length})).filter(row=>row.count>0);
  if(affected.length)relevant.push({...event,affected});
 }
 if(!relevant.length){const feed=node('a','USGS · feed da última hora ↗');feed.href='https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';feed.target='_blank';feed.rel='noopener noreferrer';panel.append(feed,node('span',' · Sem tremores leves próximos aos destinos dos UTAUs na última hora.'));return;}
 const heading=node('strong',`${relevant.length} ${relevant.length===1?'tremor leve':'tremores leves'} perto de destinos`);panel.append(heading);
 for(const event of relevant.slice(0,2)){
  const entry=node('p'),near=event.affected.slice(0,3),names=near.map(row=>row.city.name).join(', '),total=near.reduce((n,row)=>n+row.count,0),date=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date(event.time));
  entry.append(node('span',`M ${event.mag.toFixed(1)} · ${event.place} · ${date}. `),node('span',`Na nossa história, ${total} UTAUs em ${names} estão seguros e bem. `));
  const source=node('a','USGS ↗');source.href=event.url;source.target='_blank';source.rel='noopener noreferrer';entry.append(source);panel.append(entry);
 }
}
async function updateQuakes(){
 try{const events=await loadNearbyQuakes(cities);globe?.earthquakes(events);renderQuakes(events);}
 catch{globe?.earthquakes([]);renderQuakes([],true);}
}
function startQuakeMonitor(){clearInterval(quakeTimer);updateQuakes();quakeTimer=setInterval(updateQuakes,3*60*1000);}
function isPaused(){return state.preferences.paused;}
function scheduleArrival(){
 clearTimeout(tripTimer);tripTimer=null;
 if(state.meeting?.status!=='travelling'||isPaused())return;
 tripStarted=Date.now();tripTimer=setTimeout(finishTrip,tripRemaining);
}
function finishTrip(){clearTimeout(tripTimer);tripTimer=null;if(!arrive(state))return;openScene(state,characters,cityById(state.meeting.city));chatOpen=true;save();refreshWorld();renderParticipants();renderMeeting();notify('Todo mundo chegou! A conversa já pode começar.');}
function addAmbientExchange(){
 const exchange=randomExchange(characters,ambientTopic);if(!exchange)return;
 ambientTopic=exchange.topic;ambientChat.push(...exchange.messages);ambientChat=ambientChat.slice(-24);
 if(!state.meeting)renderAmbientChat();
}
function renderAmbientChat(){
 const container=$('ambient-messages'),nearBottom=container.scrollHeight-container.scrollTop-container.clientHeight<50,fragment=document.createDocumentFragment();
 for(const message of ambientChat){
  const row=node('article',undefined,'ambient-message'),who=node('div',undefined,'ambient-speaker');who.append(portrait(message.speaker),node('strong',message.speaker.name));
  row.append(who,node('p',message.text));fragment.append(row);
 }
 container.replaceChildren(fragment);$('ambient-topic').textContent=ambientTopic||'Papo aleatório';
 if(chatOpen&&nearBottom)container.scrollTop=container.scrollHeight;
}
function startAmbientChat(){
 if(characters.length<2)return;
 while(ambientChat.length<6)addAmbientExchange();
 clearInterval(ambientChatTimer);ambientChatTimer=setInterval(addAmbientExchange,11_000);
}
function renderMeeting(){
 const m=state.meeting;$('journey').replaceChildren();$('messages').replaceChildren();$('choices').replaceChildren();
 $('chat-launcher').hidden=false;$('conversation').hidden=!chatOpen;$('chat-empty').hidden=Boolean(m)||!chatOpen;$('messages').hidden=!m;$('choices').hidden=!m;
 $('chat-subtitle').textContent=m?(m.status==='travelling'?'A caminho do encontro':'Conversa do encontro'):'Conversas entre UTAUs';
 $('chat-launcher-label').textContent=!m?'Chat ao vivo':m.status==='travelling'?'Em viagem':chatOpen?'Conversa aberta':'Retomar conversa';
 $('chat-launcher').setAttribute('aria-label',!m?'Abrir chat do uMapas':m.status==='travelling'?'Ver chat durante a viagem':chatOpen?'Chat do uMapas aberto':'Retomar conversa do encontro');
 $('chat-launcher').setAttribute('aria-expanded',String(chatOpen));
 $('meeting-country').disabled=m?.status==='travelling';$('city').disabled=m?.status==='travelling';
 if(!m){$('chat-status').hidden=true;renderAmbientChat();return;}
 const c=cityById(m.city),scene=scenes.find(s=>s.id===m.scene);
 $('chat-status').hidden=m.status!=='travelling';$('chat-status').textContent=m.status==='travelling'?`O grupo está a caminho de ${c.name}. A conversa começa quando todos chegarem.`:'';
 $('journey').append(node('strong',`${m.status==='travelling'?'A caminho de':'Encontro em'} ${c.name}`),node('p',`${c.country} · ${c.continent}`));
 if(m.status==='travelling'){
  for(const id of m.participants){const p=characters.find(p=>p.id===id);$('journey').append(node('p',`${p.name}: ${cityById(m.from[id]).name} → ${c.name}`));}
  const button=node('button','Chegar agora');button.type='button';button.onclick=finishTrip;$('journey').append(node('p',isPaused()?'Viagem pausada. Você também pode chegar agora.':'Acompanhe as rotas douradas no globo. A chegada acontece em alguns segundos.'),button);return;
 }
 for(const message of state.history){const row=node('div',undefined,'message'+(message.speaker==='Você'?' visitor':''));row.append(node('strong',message.speaker),node('p',message.text));$('messages').append(row);}
 if(m.step<2)for(const [index,text] of scene.decisions[m.step].entries()){const button=node('button',text);button.type='button';button.onclick=()=>{choose(state,index,characters);save();renderMeeting();};$('choices').append(button);}
 else {const button=node('button','Continuar a conversa ✦');button.type='button';button.onclick=()=>{const next=pickScene(m.topic,state.lastScenes[m.topic]);m.scene=next.id;m.step=0;m.choices=[];state.lastScenes[m.topic]=next.id;openScene(state,characters,c);save();renderMeeting();};$('choices').append(button);}
 if(scene.source){const a=node('a','Ler a documentação técnica ↗');a.href=scene.source;a.target='_blank';a.rel='noopener noreferrer';$('choices').append(a);}
 $('messages').scrollTop=$('messages').scrollHeight;
}
function applyPause(){const paused=isPaused();const label=paused?'Retomar animações':'Pausar animações';$('pause').setAttribute('aria-label',label);$('pause').title=label;$('pause').setAttribute('aria-pressed',String(paused));document.body.classList.toggle('stars-paused',paused);globe?.pause(paused);}
$('explore-tab').onclick=()=>tab('explore');$('meeting-tab').onclick=()=>{if(chatOpen){chatOpen=false;renderMeeting();}tab('meeting');};
window.addEventListener('scroll',()=>{if(chatOpen&&matchMedia('(max-width: 800px)').matches){const panelRect=$('panel').getBoundingClientRect();if(panelRect.top<innerHeight*.75&&panelRect.bottom>80){chatOpen=false;renderMeeting();}}},{passive:true});
$('chat-launcher').onclick=()=>{chatOpen=!chatOpen;renderMeeting();};$('chat-close').onclick=()=>{chatOpen=false;renderMeeting();};
$('chat-choose').onclick=()=>{chatOpen=false;renderMeeting();tab('explore');$('search').focus();$('panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});};
for(const id of ['explore-tab','meeting-tab'])$(id).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'explore':e.key==='End'?'meeting':id==='explore-tab'?'meeting':'explore';if(next==='meeting'&&chatOpen){chatOpen=false;renderMeeting();}tab(next);$(next+'-tab').focus();}};
$('search').oninput=renderList;$('person-country').onchange=renderList;$('meeting-country').onchange=()=>{const city=fillMeetingCities();updateWeather(city);};$('city').onchange=()=>updateWeather();$('search').onkeydown=e=>{if(e.key==='Enter')$('characters').querySelector('.person-open')?.click();};
$('collapse').onclick=()=>{state.preferences.collapsed=!state.preferences.collapsed;applyCollapse();save();};
$('pause').onclick=()=>{if(tripTimer){tripRemaining=Math.max(0,tripRemaining-(Date.now()-tripStarted));clearTimeout(tripTimer);tripTimer=null;}state.preferences.paused=!state.preferences.paused;applyPause();scheduleArrival();renderMeeting();save();};
$('home').onclick=()=>globe?.focus({lat:-15,lng:-48});$('random').onclick=()=>{if(characters.length){$('search').value='';$('person-country').value='';showProfile(characters[Math.floor(Math.random()*characters.length)]);}};
$('settings').onclick=()=>$('preferences').showModal();
$('restore').onclick=()=>{clearTimeout(tripTimer);ambientEnabled=true;state.destinations={};state.ambientDestinations={};state.ambientFlights=[];state.meeting=null;save();refreshWorld();renderParticipants();renderMeeting();manageAmbientFlights();$('data-status').textContent='Destinos iniciais restaurados. O encontro foi encerrado; o histórico permanece até você limpar os dados.';};
$('clear').onclick=()=>{clearTimeout(tripTimer);ambientEnabled=false;storage.clear();state=freshState();selected.clear();active=null;$('profile').replaceChildren();applyPause();applyCollapse();refreshWorld();renderParticipants();renderMeeting();renderFlightFeed();$('data-status').textContent=storageFailed?'A sessão foi limpa. O navegador não permite acessar o armazenamento.':'Dados locais apagados. As viagens automáticas ficam pausadas até recarregar a página.';};
$('meeting-form').onsubmit=e=>{e.preventDefault();if(state.meeting?.status==='travelling')return;try{for(const id of selected)cancelAmbientFlight(state,id);const topic=$('topic').value,scene=pickScene(topic,state.lastScenes[topic]);startMeeting(state,[...selected],$('city').value,topic,scene,characters,cities);tripRemaining=5000;chatOpen=false;save();globe?.update(characters,state);globe?.focus(cityById(state.meeting.city));renderParticipants();renderMeeting();if(active)showProfile(active,false);tab('meeting');scheduleArrival();}catch(error){notify(error.message);}};
$('refresh').onclick=async()=>{const button=$('refresh');button.disabled=true;$('wiki-status').textContent='Consultando retratos da VSynthBR…';try{characters=await refreshCatalog(characters);refreshWorld();$('wiki-status').textContent='Retratos atualizados · viagens preservadas';}catch{$('wiki-status').textContent='Wiki indisponível · catálogo local preservado';notify('A wiki não respondeu. Você pode continuar explorando e conversando.');}finally{button.disabled=false;}};
try {
 ({characters,cities,capitals}=await loadCatalog());state=sanitize(storage.load(),characters,cities,scenes);chatOpen=state.meeting?.status==='arrived';if(state.meeting)selected=new Set(state.meeting.participants);
 fillCountryOptions($('person-country'));fillCountryOptions($('meeting-country'));
 const restoredCity=state.meeting?.city||'';const restoredCountry=cityById(restoredCity)?.country||'Brasil';$('meeting-country').value=restoredCountry;fillMeetingCities(restoredCity);
 for(const [id,name]of Object.entries(topics))$('topic').append(option(id,name));
 if(state.meeting){$('topic').value=state.meeting.topic;tab('meeting');}
 applyCollapse();renderList();renderParticipants();startAmbientChat();renderMeeting();updateWeather();
 globe=await createGlobe($('globe'),cities,group=>showGlobeCard(group,group.people.length===1?group.people[0]:null),()=>{$('globe-status').textContent='Globo indisponível. Explore pela lista e organize encontros no painel.';});
 globe.update(characters,state);applyPause();startQuakeMonitor();if(state.meeting)globe.focus(cityById(state.meeting.city));scheduleArrival();manageAmbientFlights();ambientTimer=setInterval(manageAmbientFlights,1000);updateCapitalWeather();capitalWeatherTimer=setInterval(updateCapitalWeather,15*60*1000);
 if(storageFailed)notify('Armazenamento indisponível. Você pode explorar e conversar nesta sessão.');
} catch(error){$('characters').textContent='Não foi possível abrir o catálogo local. Recarregue a página servida por HTTP.';notify(error.message);}
