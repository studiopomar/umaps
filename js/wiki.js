const previews=new Map();
const clean=value=>(value||'').replace(/\s+/g,' ').trim();

function parsePreview(html){
 const document=new DOMParser().parseFromString(html,'text/html');
 const root=document.querySelector('.mw-parser-output')||document.body;
 const facts=[];
 for(const item of root.querySelectorAll('.portable-infobox .pi-data')){
  const label=clean(item.querySelector('.pi-data-label')?.textContent);
  const value=clean(item.querySelector('.pi-data-value')?.textContent);
  if(label&&value&&!facts.some(fact=>fact.label===label))facts.push({label,value});
 }
 const intro=[...root.querySelectorAll('p')].map(paragraph=>clean(paragraph.textContent)).find(text=>text.length>30)||'';
 return {intro:intro.length>520?`${intro.slice(0,517).trimEnd()}…`:intro,facts:facts.slice(0,8)};
}

export function getWikiPreview(person,fetcher=fetch){
 if(previews.has(person.id))return previews.get(person.id);
 const request=(async()=>{
  if(!Number.isInteger(person.pageId))throw Error('Página da wiki indisponível');
  const url=new URL('https://vsynthbr.fandom.com/pt-br/api.php');
  url.search=new URLSearchParams({action:'parse',pageid:String(person.pageId),prop:'text',section:'0',format:'json',origin:'*'});
  const response=await fetcher(url,{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Wiki indisponível');
  const data=await response.json(),html=data.parse?.text?.['*'];
  if(typeof html!=='string')throw Error('Resumo da wiki indisponível');
  return parsePreview(html);
 })();
 previews.set(person.id,request);
 request.catch(()=>previews.delete(person.id));
 return request;
}
