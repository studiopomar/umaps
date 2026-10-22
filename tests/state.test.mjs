import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateCatalog} from '../js/catalog.js';
import {sanitize,freshState,createStorage} from '../js/storage.js';
import {destination,startMeeting,arrive,groupByCity} from '../js/travel.js';
import {scenes,pickScene,openScene,choose} from '../js/dialogue.js';
const characters=JSON.parse(await readFile(new URL('../data/characters.json',import.meta.url))).characters;
const cities=JSON.parse(await readFile(new URL('../data/cities.json',import.meta.url)));
test('local catalogue has unique sourced Brazilian IDs and valid exact city coordinates/timezones',()=>{validateCatalog(characters,cities);assert.ok(characters.length>250);assert.throws(()=>validateCatalog(characters,[{...cities[0],lat:91}]));});
test('trip, arrival, both dialogue branches and restored state stay coherent',()=>{
 for(const topic of ['sing','oto','bank','walk'])for(const a of [0,1])for(const b of [0,1]){
 const state=freshState(),ids=characters.slice(0,4).map(c=>c.id),scene=pickScene(topic,null),city=cities[11];
 startMeeting(state,ids,city.id,topic,scene,characters,cities);
 const travelling=sanitize(JSON.parse(JSON.stringify(state)),characters,cities,scenes);assert.equal(travelling.meeting.status,'travelling');
 arrive(state);openScene(state,characters,city);choose(state,a,characters);choose(state,b,characters);
 const restored=sanitize(JSON.parse(JSON.stringify(state)),characters,cities,scenes);assert.equal(restored.meeting.step,2);assert.equal(restored.meeting.scene,scene.id);
 for(const id of ids)assert.equal(destination(characters.find(c=>c.id===id),restored),city.id);
 assert.equal(groupByCity(characters,restored).find(g=>g.city===city.id).people.filter(p=>ids.includes(p.id)).length,4);
 assert.notEqual(pickScene(topic,scene.id).id,scene.id);
 }
});
test('each topic has three scenes with two real decisions',()=>{for(const topic of ['sing','oto','bank','walk']){assert.equal(scenes.filter(s=>s.topic===topic).length,3);for(const s of scenes.filter(s=>s.topic===topic)){assert.equal(s.decisions.length,2);assert.ok(s.decisions.every(d=>d.length===2));assert.ok(s.replies.every(r=>r.length===2));}}});
test('corrupt, obsolete and unavailable storage remain usable',()=>{assert.deepEqual(sanitize({version:1},characters,cities,scenes),freshState());const state=freshState();state.destinations={bad:'missing'};state.history=Array.from({length:150},()=>({speaker:'Você',text:'ok'}));state.meeting={participants:['bad']};const clean=sanitize(state,characters,cities,scenes);assert.equal(clean.history.length,100);assert.equal(clean.meeting,null);assert.deepEqual(clean.destinations,{});let errors=0;globalThis.localStorage={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}};const storage=createStorage(()=>errors++);assert.equal(storage.load(),null);assert.equal(storage.save(state),false);assert.equal(storage.clear(),false);assert.equal(errors,3);});
